import prisma from "@/lib/prisma";
import { format } from "date-fns";
import type { BookingStatus } from "@prisma/client";
import type { UpdateBookingSchemaInput } from "@/lib/validations/booking";
import { BusinessRuleError } from "@/lib/errors";
import { VALID_STATUS_TRANSITIONS } from "./booking-constants";

/**
 * Generate booking reference: BK-YYYYMMDD-XXX
 */
export async function generateBookingRef(): Promise<string> {
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
    // Explicit radix so a hypothetical "08"/"09" suffix doesn't fall
    // into octal parsing quirks on older runtimes.
    const lastNumber = parseInt(
      lastBooking.bookingRef.split("-").pop() || "0",
      10,
    );
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, "0")}`;
}

/**
 * Maximum retries when a concurrent bookingRef collision hits Prisma's
 * `@unique` constraint. See `createBooking` for the retry loop.
 */
export const MAX_BOOKING_REF_RETRIES = 3;

/**
 * Check for overlapping bookings for a room
 * @param roomId - Room to check
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param excludeBookingId - Booking ID to exclude (for updates)
 * @returns The overlapping booking if found, null otherwise
 */
export async function findOverlappingBooking(
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
export function validateStatusTransition(
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

/**
 * Build the Prisma update payload from a validated update input.
 * Only defined fields are included; date strings are parsed to Date objects.
 */
export function pickUpdateFields(
  data: UpdateBookingSchemaInput
): Record<string, unknown> {
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
  if (data.checkIn !== undefined) updateData.checkIn = new Date(data.checkIn);
  if (data.checkInTime !== undefined) updateData.checkInTime = data.checkInTime;
  if (data.checkOut !== undefined) updateData.checkOut = new Date(data.checkOut);
  if (data.checkOutTime !== undefined) updateData.checkOutTime = data.checkOutTime;
  if (data.bondDeposit !== undefined) updateData.bondDeposit = data.bondDeposit;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;

  return updateData;
}
