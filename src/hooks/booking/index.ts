/**
 * Booking Hooks Module
 *
 * Public surface — the query keys, query hooks, and mutation hooks that
 * components consume. Optimistic-update helpers and raw `booking-api`
 * fetchers are internal to this folder and imported via relative paths
 * where needed; they are NOT re-exported to keep the module boundary tight.
 */

// Export query keys
export { bookingKeys } from "./booking-keys";

// Export query hooks
export { useBookings } from "./booking-queries";
export { useFetchBooking } from "./use-fetch-booking";

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
