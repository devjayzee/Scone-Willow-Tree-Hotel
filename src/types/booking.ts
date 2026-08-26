import type { BookingStatus } from "@prisma/client";
import type { RoomSummary } from "./room";

// Re-export types for convenience
export type { BookingStatus };
export type { RoomSummary };

// Creator info for booking
export interface BookingCreator {
  firstName: string;
  lastName: string;
}

// Full booking type for API responses
export interface Booking {
  id: string;
  bookingRef: string;
  roomId: string;
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
  // Per-night rate snapshotted at booking creation. Decimal
  // serialized like bondDeposit — string or number over the wire.
  ratePerNight: string | number;
  status: BookingStatus;
  isPaid: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  room: RoomSummary;
  createdBy?: BookingCreator;
}

// Minimal booking type for table display
export interface BookingSummary {
  id: string;
  bookingRef: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  isPaid: boolean;
  room: {
    roomNumber: string;
  };
}

// Input type for creating a booking
export interface CreateBookingInput {
  roomId: string;
  guestName: string;
  guestDateOfBirth?: string;
  guestAddress?: string;
  guestPhone: string;
  guestEmail?: string;
  vehicleRego?: string;
  additionalGuests?: string;
  checkIn: string;
  checkInTime?: string;
  checkOut: string;
  checkOutTime?: string;
  bondDeposit?: number;
  notes?: string;
}

// Input type for updating a booking
export interface UpdateBookingInput {
  roomId?: string;
  guestName?: string;
  guestDateOfBirth?: string | null;
  guestAddress?: string | null;
  guestPhone?: string | null;
  guestEmail?: string;
  vehicleRego?: string | null;
  additionalGuests?: string | null;
  checkIn?: string;
  checkInTime?: string | null;
  checkOut?: string;
  checkOutTime?: string | null;
  bondDeposit?: number | null;
  status?: BookingStatus;
  notes?: string | null;
}
