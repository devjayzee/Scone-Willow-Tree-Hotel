import prisma from "@/lib/prisma";
import type {
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
  validateStatusTransition,
} from "./booking-utils";

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

  const bookingRef = await generateBookingRef();

  const booking = await prisma.booking.create({
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

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (data.roomId !== undefined) updateData.roomId = data.roomId;
  if (data.guestName !== undefined) updateData.guestName = data.guestName;
  if (data.guestDateOfBirth !== undefined) {
    updateData.guestDateOfBirth = data.guestDateOfBirth
      ? new Date(data.guestDateOfBirth)
      : null;
  }
  if (data.guestAddress !== undefined) updateData.guestAddress = data.guestAddress;
  if (data.guestPhone !== undefined) updateData.guestPhone = data.guestPhone;
  if (data.guestEmail !== undefined) updateData.guestEmail = data.guestEmail;
  if (data.vehicleRego !== undefined) updateData.vehicleRego = data.vehicleRego;
  if (data.additionalGuests !== undefined)
    updateData.additionalGuests = data.additionalGuests;
  if (data.checkIn !== undefined) updateData.checkIn = checkInDate;
  if (data.checkInTime !== undefined) updateData.checkInTime = data.checkInTime;
  if (data.checkOut !== undefined) updateData.checkOut = checkOutDate;
  if (data.checkOutTime !== undefined) updateData.checkOutTime = data.checkOutTime;
  if (data.bondDeposit !== undefined) updateData.bondDeposit = data.bondDeposit;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const booking = await prisma.booking.update({
    where: { id },
    data: updateData,
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
