import { getAllBookings } from "@/lib/services/booking-service";
import { getAllRooms } from "@/lib/services/room-service";
import { BookingsClient } from "@/components/booking/bookings-client";
import type { Booking } from "@/types/booking";
import type { RoomSummary } from "@/types/room";

export default async function BookingsPage() {
  // Fetch data server-side
  const [bookings, rooms] = await Promise.all([getAllBookings(), getAllRooms()]);

  // Serialize dates for client component
  const serializedBookings: Booking[] = bookings.map((booking) => ({
    id: booking.id,
    bookingRef: booking.bookingRef,
    roomId: booking.roomId,
    guestName: booking.guestName,
    guestDateOfBirth: booking.guestDateOfBirth?.toISOString() ?? null,
    guestAddress: booking.guestAddress,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    vehicleRego: booking.vehicleRego,
    additionalGuests: booking.additionalGuests,
    checkIn: booking.checkIn.toISOString(),
    checkInTime: booking.checkInTime,
    checkOut: booking.checkOut.toISOString(),
    checkOutTime: booking.checkOutTime,
    bondDeposit: booking.bondDeposit?.toString() ?? null,
    status: booking.status,
    isPaid: booking.isPaid,
    notes: booking.notes,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    room: {
      id: booking.room.id,
      roomNumber: booking.room.roomNumber,
      capacity: booking.room.capacity,
      pricePerNight: booking.room.pricePerNight.toString(),
    },
    createdBy: booking.createdBy
      ? {
          firstName: booking.createdBy.firstName,
          lastName: booking.createdBy.lastName,
        }
      : undefined,
  }));

  // Serialize rooms for client component
  const serializedRooms: RoomSummary[] = rooms.map((room) => ({
    id: room.id,
    roomNumber: room.roomNumber,
    capacity: room.capacity,
    pricePerNight: room.pricePerNight.toString(),
    description: room.description,
  }));

  return (
    <BookingsClient
      initialBookings={serializedBookings}
      initialRooms={serializedRooms}
    />
  );
}
