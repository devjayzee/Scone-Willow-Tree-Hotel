/**
 * Booking Registration PDF
 *
 * This file re-exports from the modular PDF generator for backwards
 * compatibility. For new code, consider importing directly from
 * '@/lib/utils/pdf/booking-registration/index'.
 *
 * @see {@link ./booking-registration/index.ts} for the modular implementation
 */

export {
  bookingToPDFData,
  generateBookingRegistrationPDF,
  downloadBookingPDF,
  downloadDraftBookingPDF,
  type BookingPDFData,
} from "./booking-registration/index";
