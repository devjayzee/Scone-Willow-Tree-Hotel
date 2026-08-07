/**
 * Booking Service Module
 *
 * Public surface — queries, mutations, and status operations that route
 * handlers consume. Utility functions (`booking-utils`) and constants
 * (`booking-constants`) are internal to this folder and imported via
 * relative paths where needed; they are NOT re-exported to keep the
 * module boundary tight.
 */

// Re-export error types for convenience
export { NotFoundError, ConflictError, BusinessRuleError } from "@/lib/errors";

// Export types
export type { GetAllBookingsOptions } from "./booking-queries";
export type { DeleteBookingResult } from "./booking-mutations";

// Export queries
export {
  getAllBookings,
  getBookingById,
  getBookingByRef,
} from "./booking-queries";

// Export mutations
export {
  createBooking,
  updateBooking,
  deleteBooking,
  applyBookingAction,
} from "./booking-mutations";

// Export status operations
export {
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  togglePaymentStatus,
  undoCheckOutBooking,
  undoCancelBooking,
} from "./booking-status";
