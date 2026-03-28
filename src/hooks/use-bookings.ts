"use client";

/**
 * Booking Hooks
 *
 * This file re-exports from the modular booking hooks for backwards compatibility.
 * For new code, consider importing directly from '@/hooks/booking'.
 *
 * @module use-bookings
 * @see {@link ./booking/index.ts} for the modular implementation
 */

export {
  // Query keys
  bookingKeys,
  // Query hooks
  useBookings,
  // Mutation hooks
  useCreateBooking,
  useUpdateBooking,
  useDeleteBooking,
  useCheckInBooking,
  useCheckOutBooking,
  useCancelBooking,
  useTogglePayment,
  useUndoCheckOutBooking,
  useUndoCancelBooking,
} from "./booking";
