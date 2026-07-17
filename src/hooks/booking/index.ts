/**
 * Booking Hooks Module
 *
 * This module provides React hooks for booking operations organized by concern:
 * - booking-keys: Query key factory for cache management
 * - booking-api: API fetch functions
 * - booking-queries: Read hooks (useBookings)
 * - booking-mutations: Write hooks (useCreateBooking, useUpdateBooking, etc.)
 * - use-optimistic-booking: Shared optimistic update utilities
 */

// Export query keys
export { bookingKeys } from "./booking-keys";

// Export query hooks
export { useBookings } from "./booking-queries";

// Export mutation hooks
export {
  useCreateBooking,
  useUpdateBooking,
  useDeleteBooking,
  useCheckInBooking,
  useCheckOutBooking,
  useCancelBooking,
  useTogglePayment,
  useUndoCheckOutBooking,
  useUndoCancelBooking,
} from "./booking-mutations";

// Export optimistic update utilities (for advanced use cases)
export {
  prepareOptimisticUpdate,
  updateBookingInCache,
  removeBookingFromCache,
  addBookingToCache,
  rollbackBookings,
  useOptimisticBookingMutation,
  type OptimisticContext,
  type CreateOptimisticMutationOptions,
} from "./use-optimistic-booking";

// Export API functions (for direct use if needed)
export {
  fetchBookings,
  fetchBookingById,
  createBookingApi,
  updateBookingApi,
  deleteBookingApi,
  performBookingAction,
  type BookingAction,
} from "./booking-api";
