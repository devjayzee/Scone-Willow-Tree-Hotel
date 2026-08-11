import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type {
  BookingActionInput,
  CreateBookingSchemaInput,
  UpdateBookingSchemaInput,
} from "@/lib/validations/booking";
import { NotFoundError, ConflictError, BusinessRuleError } from "@/lib/errors";
import {
  createAuditLog,
  AuditAction,
  EntityType,
  sanitizeForAudit,
  getChangedFields,
} from "../audit-service";
import { bookingSelectFields } from "./booking-constants";
import {
  generateBookingRef,
  findOverlappingBooking,
  pickUpdateFields,
  validateStatusTransition,
  MAX_BOOKING_REF_RETRIES,
} from "./booking-utils";

function isBookingRefCollision(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes("bookingRef")
  );
}
import {
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  togglePaymentStatus,
  undoCheckOutBooking,
  undoCancelBooking,
} from "./booking-status";

/**
 * Create a new booking
 * @throws ConflictError if room is not available for the dates
 */
export async function createBooking(
  data: CreateBookingSchemaInput,
  createdById: string,
  performedBy?: string
) {
  const checkInDate = new Date(data.checkIn);
  const checkOutDate = new Date(data.checkOut);

  // Check for overlapping bookings
  const overlapping = await findOverlappingBooking(
    data.roomId,
    checkInDate,
    checkOutDate
  );

  if (overlapping) {
    throw new ConflictError(
      `Room is not available for the selected dates. Conflicts with booking ${overlapping.bookingRef} (${overlapping.guestName})`
    );
  }

  // Verify room exists
  const room = await prisma.room.findUnique({
    where: { id: data.roomId },
    select: { id: true, roomNumber: true },
  });

  if (!room) {
    throw new NotFoundError("Room not found");
  }

  // Concurrent creates for the same date can race on the sequence
  // number returned by generateBookingRef — both reads see the same
  // `last` before either commits, so both try to write the same ref
  // and one hits P2002 on the @unique column. Retry-on-collision
  // resolves it without introducing a transaction / advisory lock
  // (small hotel volumes; the loop very rarely fires more than once).
  let booking;
  for (let attempt = 0; attempt < MAX_BOOKING_REF_RETRIES; attempt++) {
    const bookingRef = await generateBookingRef();
    try {
      booking = await prisma.booking.create({
        data: {
          bookingRef,
          roomId: data.roomId,
          guestName: data.guestName,
          guestDateOfBirth: data.guestDateOfBirth
            ? new Date(data.guestDateOfBirth)
            : null,
          guestAddress: data.guestAddress || null,
          guestPhone: data.guestPhone,
          guestEmail: data.guestEmail || null,
          vehicleRego: data.vehicleRego || null,
          additionalGuests: data.additionalGuests || null,
          checkIn: checkInDate,
          checkInTime: data.checkInTime || null,
          checkOut: checkOutDate,
          checkOutTime: data.checkOutTime || null,
          bondDeposit: data.bondDeposit ?? null,
          notes: data.notes || null,
          createdById,
        },
        select: bookingSelectFields,
      });
      break;
    } catch (err) {
      if (isBookingRefCollision(err)) continue;
      throw err;
    }
  }
  if (!booking) {
    // Exhausted retries — surface a ConflictError so the caller sees a
    // domain error instead of an unmapped Prisma exception (#188).
    throw new ConflictError(
      "Could not allocate a unique booking reference — try again",
    );
  }

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_CREATED,
      EntityType.BOOKING,
      booking.id,
      {
        current: sanitizeForAudit({
          bookingRef: booking.bookingRef,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          roomNumber: room.roomNumber,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
        }),
      }
    );
  }

  return booking;
}

/**
 * Update an existing booking
 * @throws NotFoundError if booking not found
 * @throws ConflictError if room is not available for the new dates
 * @throws BusinessRuleError if status transition is invalid
 */
export async function updateBooking(
  id: string,
  data: UpdateBookingSchemaInput,
  performedBy?: string
) {
  const existingBooking = await prisma.booking.findUnique({
    where: { id },
    include: { room: { select: { roomNumber: true } } },
  });

  if (!existingBooking) {
    throw new NotFoundError("Booking not found");
  }

  // Validate status transition if status is being changed
  if (data.status && data.status !== existingBooking.status) {
    validateStatusTransition(existingBooking.status, data.status);
  }

  // Check for date/room changes that might cause conflicts
  const checkInDate = data.checkIn
    ? new Date(data.checkIn)
    : existingBooking.checkIn;
  const checkOutDate = data.checkOut
    ? new Date(data.checkOut)
    : existingBooking.checkOut;
  const roomId = data.roomId ?? existingBooking.roomId;

  // Only check for overlaps if dates or room changed
  if (data.checkIn || data.checkOut || data.roomId) {
    const overlapping = await findOverlappingBooking(
      roomId,
      checkInDate,
      checkOutDate,
      id
    );

    if (overlapping) {
      throw new ConflictError(
        `Room is not available for the selected dates. Conflicts with booking ${overlapping.bookingRef}`
      );
    }
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: pickUpdateFields(data),
    select: bookingSelectFields,
  });

  // Audit logging
  if (performedBy) {
    const changedFields = getChangedFields(
      existingBooking as unknown as Record<string, unknown>,
      data as Record<string, unknown>
    );

    if (changedFields.length > 0) {
      await createAuditLog(
        performedBy,
        AuditAction.BOOKING_UPDATED,
        EntityType.BOOKING,
        id,
        {
          previous: sanitizeForAudit(
            Object.fromEntries(
              changedFields.map((f) => [
                f,
                existingBooking[f as keyof typeof existingBooking],
              ])
            )
          ),
          current: sanitizeForAudit(
            Object.fromEntries(
              changedFields.map((f) => [f, data[f as keyof typeof data]])
            )
          ),
          changedFields,
        }
      );
    }
  }

  return booking;
}

export interface DeleteBookingResult {
  deleted: boolean;
  message: string;
}

/**
 * Delete a booking permanently
 * Only allowed for CANCELLED or CHECKED_OUT bookings
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if booking cannot be deleted
 */
export async function deleteBooking(
  id: string,
  performedBy?: string
): Promise<DeleteBookingResult> {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      bookingRef: true,
      guestName: true,
      guestEmail: true,
      status: true,
      room: { select: { roomNumber: true } },
    },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  // Only allow deletion of cancelled or checked out bookings
  if (booking.status !== "CANCELLED" && booking.status !== "CHECKED_OUT") {
    throw new BusinessRuleError(
      `Cannot delete booking with status ${booking.status}. Cancel or check out first.`
    );
  }

  await prisma.booking.delete({
    where: { id },
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_DELETED,
      EntityType.BOOKING,
      id,
      {
        previous: sanitizeForAudit({
          bookingRef: booking.bookingRef,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          roomNumber: booking.room.roomNumber,
          status: booking.status,
        }),
      }
    );
  }

  return {
    deleted: true,
    message: "Booking deleted successfully",
  };
}

/**
 * Dispatch a booking action to the appropriate status transition function.
 * Single service-layer entry point for the PATCH route (and any future CLI
 * or background caller) so route handlers stay Rule-1 compliant.
 */
export async function applyBookingAction(
  id: string,
  action: BookingActionInput,
  performedBy: string,
) {
  switch (action.action) {
    case "check-in":
      return checkInBooking(id, performedBy);
    case "check-out":
      return checkOutBooking(id, performedBy);
    case "undo-checkout":
      return undoCheckOutBooking(id, performedBy);
    case "undo-cancel":
      return undoCancelBooking(id, performedBy);
    case "cancel":
      return cancelBooking(id, action.reason, performedBy);
    case "toggle-payment":
      return togglePaymentStatus(id, performedBy);
  }
}
