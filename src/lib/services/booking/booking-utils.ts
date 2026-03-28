import prisma from "@/lib/prisma";
import { format } from "date-fns";
import type { BookingStatus } from "@prisma/client";
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
