import type { BookingStatus } from "@prisma/client";
import type { RoomSummary } from "./room";

// Re-export types for convenience
export type { BookingStatus };
export type { RoomSummary };

// Alias for backwards compatibility (deprecated, use RoomSummary)
export type BookingRoom = RoomSummary;

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
  guestEmail: string;
  guestPhone?: string | null;
  vehicleRego?: string | null;
  additionalGuests?: string | null;
  checkIn: string;
  checkInTime?: string | null;
  checkOut: string;
  checkOutTime?: string | null;
  bondDeposit?: string | number | null;
  status: BookingStatus;
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
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
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
  guestPhone?: string;
  guestEmail: string;
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
