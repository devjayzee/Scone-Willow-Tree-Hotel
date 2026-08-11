import type { Booking } from "@/types/booking";

/**
 * Data shape the PDF generator expects. Supports both persisted bookings and
 * unsaved draft form data (draft path is used from use-booking-form.ts).
 */
export interface BookingPDFData {
  guestName: string;
  guestDateOfBirth?: string | null;
  guestAddress?: string | null;
  guestEmail?: string | null;
  guestPhone: string;
  vehicleRego?: string | null;
  additionalGuests?: string | null;
  checkIn: string;
  checkInTime?: string | null;
  checkOut: string;
  checkOutTime?: string | null;
  bondDeposit?: string | number | null;
  roomNumber: string;
  pricePerNight: number;
}

/**
 * Convert a persisted Booking object to the PDF-facing shape.
 *
 * Reads booking.ratePerNight (snapshotted at booking creation, #185)
 * rather than booking.room.pricePerNight — so a customer printing
 * their registration two years later sees the rate they were
 * actually charged, not whatever the room costs today.
 */
export function bookingToPDFData(booking: Booking): BookingPDFData {
  const pricePerNight =
    typeof booking.ratePerNight === "string"
      ? parseFloat(booking.ratePerNight)
      : booking.ratePerNight;

  return {
    guestName: booking.guestName,
    guestDateOfBirth: booking.guestDateOfBirth,
    guestAddress: booking.guestAddress,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    vehicleRego: booking.vehicleRego,
    additionalGuests: booking.additionalGuests,
    checkIn: booking.checkIn,
    checkInTime: booking.checkInTime,
    checkOut: booking.checkOut,
    checkOutTime: booking.checkOutTime,
    bondDeposit: booking.bondDeposit,
    roomNumber: booking.room.roomNumber,
    pricePerNight,
  };
}
