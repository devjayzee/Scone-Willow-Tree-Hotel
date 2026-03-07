import prisma from "@/lib/prisma";
import { format } from "date-fns";
import type { BookingStatus } from "@prisma/client";
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
} from "./audit-service";

// Re-export error types for convenience
export { NotFoundError, ConflictError, BusinessRuleError };

// Booking select fields for consistent responses
const bookingSelectFields = {
  id: true,
  bookingRef: true,
  roomId: true,
  guestName: true,
  guestDateOfBirth: true,
  guestAddress: true,
  guestEmail: true,
  guestPhone: true,
  vehicleRego: true,
  additionalGuests: true,
  checkIn: true,
  checkInTime: true,
  checkOut: true,
  checkOutTime: true,
  bondDeposit: true,
  status: true,
  isPaid: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  room: {
    select: {
      id: true,
      roomNumber: true,
      capacity: true,
      pricePerNight: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["CHECKED_OUT", "CANCELLED"],
  CHECKED_OUT: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Generate booking reference: BK-YYYYMMDD-XXX
 */
async function generateBookingRef(): Promise<string> {
  const today = format(new Date(), "yyyyMMdd");
  const prefix = `BK-${today}-`;

  // Find the last booking reference for today
  const lastBooking = await prisma.booking.findFirst({
    where: {
      bookingRef: {
        startsWith: prefix,
      },
    },
    orderBy: {
      bookingRef: "desc",
    },
  });

  let nextNumber = 1;
  if (lastBooking) {
    const lastNumber = parseInt(lastBooking.bookingRef.split("-").pop() || "0");
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, "0")}`;
}

/**
 * Check for overlapping bookings for a room
 * @param roomId - Room to check
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param excludeBookingId - Booking ID to exclude (for updates)
 * @returns The overlapping booking if found, null otherwise
 */
async function findOverlappingBooking(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string
) {
  return prisma.booking.findFirst({
    where: {
      roomId,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
      OR: [
        {
          // New booking starts during existing booking
          AND: [{ checkIn: { lte: checkIn } }, { checkOut: { gt: checkIn } }],
        },
        {
          // New booking ends during existing booking
          AND: [{ checkIn: { lt: checkOut } }, { checkOut: { gte: checkOut } }],
        },
        {
          // New booking completely contains existing booking
          AND: [{ checkIn: { gte: checkIn } }, { checkOut: { lte: checkOut } }],
        },
      ],
    },
    select: {
      bookingRef: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
    },
  });
}

/**
 * Validate status transition
 * @throws BusinessRuleError if transition is invalid
 */
function validateStatusTransition(
  currentStatus: BookingStatus,
  newStatus: BookingStatus
): void {
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

  if (!validTransitions.includes(newStatus)) {
    throw new BusinessRuleError(
      `Cannot change status from ${currentStatus} to ${newStatus}`
    );
  }
}

export interface GetAllBookingsOptions {
  status?: BookingStatus;
  roomId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Get all bookings with optional filtering
 */
export async function getAllBookings(options?: GetAllBookingsOptions) {
  const { status, roomId, startDate, endDate } = options ?? {};

  const bookings = await prisma.booking.findMany({
    where: {
      ...(status && { status }),
      ...(roomId && { roomId }),
      ...(startDate && { checkIn: { gte: startDate } }),
      ...(endDate && { checkOut: { lte: endDate } }),
    },
    select: bookingSelectFields,
    orderBy: [{ checkIn: "desc" }, { bookingRef: "desc" }],
  });

  return bookings;
}

/**
 * Get a single booking by ID
 * @throws NotFoundError if booking not found
 */
export async function getBookingById(id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: bookingSelectFields,
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return booking;
}

/**
 * Get a single booking by booking reference
 * @throws NotFoundError if booking not found
 */
export async function getBookingByRef(bookingRef: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    select: bookingSelectFields,
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return booking;
}

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

/**
 * Check in a booking
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if booking cannot be checked in
 */
export async function checkInBooking(id: string, performedBy?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, bookingRef: true, guestName: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  validateStatusTransition(booking.status, "CHECKED_IN");

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: "CHECKED_IN" },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_CHECKED_IN,
      EntityType.BOOKING,
      id,
      {
        previous: { status: booking.status },
        current: { status: "CHECKED_IN" },
      }
    );
  }

  return updatedBooking;
}

/**
 * Check out a booking
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if booking cannot be checked out
 */
export async function checkOutBooking(id: string, performedBy?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, bookingRef: true, guestName: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  validateStatusTransition(booking.status, "CHECKED_OUT");

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: "CHECKED_OUT" },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_CHECKED_OUT,
      EntityType.BOOKING,
      id,
      {
        previous: { status: booking.status },
        current: { status: "CHECKED_OUT" },
      }
    );
  }

  return updatedBooking;
}

/**
 * Cancel a booking
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if booking cannot be cancelled
 */
export async function cancelBooking(
  id: string,
  reason?: string,
  performedBy?: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, bookingRef: true, guestName: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  validateStatusTransition(booking.status, "CANCELLED");

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_CANCELLED,
      EntityType.BOOKING,
      id,
      {
        previous: { status: booking.status },
        current: { status: "CANCELLED" },
        reason: reason || "Booking cancelled",
      }
    );
  }

  return updatedBooking;
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
  if (!["CANCELLED", "CHECKED_OUT"].includes(booking.status)) {
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
 * Toggle payment status for a booking
 * @throws NotFoundError if booking not found
 */
export async function togglePaymentStatus(id: string, performedBy?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, isPaid: true, bookingRef: true, guestName: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  const newIsPaid = !booking.isPaid;

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { isPaid: newIsPaid },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      newIsPaid ? AuditAction.BOOKING_UPDATED : AuditAction.BOOKING_UPDATED,
      EntityType.BOOKING,
      id,
      {
        previous: { isPaid: booking.isPaid },
        current: { isPaid: newIsPaid },
      }
    );
  }

  return updatedBooking;
}
