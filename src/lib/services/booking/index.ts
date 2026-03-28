/**
 * Booking Service Module
 *
 * This module provides all booking-related operations organized by concern:
 * - booking-queries: Read operations (getAllBookings, getBookingById, getBookingByRef)
 * - booking-mutations: Write operations (createBooking, updateBooking, deleteBooking)
 * - booking-status: Status transitions (checkIn, checkOut, cancel, togglePayment)
 * - booking-utils: Shared utilities (generateBookingRef, findOverlappingBooking)
 * - booking-constants: Shared constants (select fields, status transitions)
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
} from "./booking-mutations";

// Export status operations
export {
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  togglePaymentStatus,
  undoCheckOutBooking,
} from "./booking-status";

// Export utilities (for advanced use cases)
export {
  generateBookingRef,
  findOverlappingBooking,
  validateStatusTransition,
} from "./booking-utils";

// Export constants (for testing or extension)
export {
  bookingSelectFields,
  VALID_STATUS_TRANSITIONS,
} from "./booking-constants";
