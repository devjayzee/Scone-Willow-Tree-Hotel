/**
 * Booking Service
 *
 * This file re-exports from the modular booking service for backwards compatibility.
 * For new code, consider importing directly from '@/lib/services/booking'.
 *
 * @module booking-service
 * @see {@link ./booking/index.ts} for the modular implementation
 */

export {
  // Error types
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  // Types
  type GetAllBookingsOptions,
  type DeleteBookingResult,
  // Queries
  getAllBookings,
  getBookingById,
  getBookingByRef,
  // Mutations
  createBooking,
  updateBooking,
  deleteBooking,
  applyBookingAction,
  // Status operations
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  togglePaymentStatus,
  undoCheckOutBooking,
  undoCancelBooking,
} from "./booking";
