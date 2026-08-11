import type { BookingStatus } from "@prisma/client";

/**
 * Booking select fields for consistent responses across all queries.
 */
export const bookingSelectFields = {
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
  ratePerNight: true,
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

/**
 * Valid status transitions for booking state machine.
 * Maps current status to allowed next statuses.
 *
 * Note: CHECKED_OUT -> CHECKED_IN is allowed only if checkout date hasn't passed.
 * Note: CANCELLED -> CONFIRMED is allowed only if checkout date hasn't passed.
 * These validations are handled in booking-status.ts undo functions.
 */
export const VALID_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["CHECKED_OUT", "CANCELLED"],
  CHECKED_OUT: ["CHECKED_IN"], // Can undo checkout if checkout date hasn't passed
  CANCELLED: ["CONFIRMED"], // Can undo cancel if check-in date hasn't passed
};
