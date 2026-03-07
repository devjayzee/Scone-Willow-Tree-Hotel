import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import type { CalendarEvent } from "@/types/calendar";

/**
 * Get calendar events (bookings) with optional filtering
 *
 * @param startDate - Optional start date for filtering (ISO string)
 * @param endDate - Optional end date for filtering (ISO string)
 * @param roomId - Optional room ID to filter by (use "all" or undefined for all rooms)
 * @returns Array of calendar events formatted for display
 */
export async function getCalendarEvents(
  startDate?: string,
  endDate?: string,
  roomId?: string
): Promise<CalendarEvent[]> {
  // Build where clause for active bookings
  const where: {
    status: { in: BookingStatus[] };
    checkIn?: { gte: Date };
    checkOut?: { lte: Date };
    roomId?: string;
  } = {
    status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
  };

  if (startDate) {
    where.checkIn = { gte: new Date(startDate) };
  }
  if (endDate) {
    where.checkOut = { lte: new Date(endDate) };
  }
  if (roomId && roomId !== "all") {
    where.roomId = roomId;
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      room: {
        select: {
          id: true,
          roomNumber: true,
        },
      },
    },
    orderBy: { checkIn: "asc" },
  });

  // Transform bookings to calendar events
  // For hotel bookings, checkout day means the room is available for new guests
  // Subtract 1 day from checkout to show only the occupied nights
  const events: CalendarEvent[] = bookings.map((booking) => {
    const displayEnd = new Date(booking.checkOut);
    displayEnd.setDate(displayEnd.getDate() - 1);

    return {
      id: booking.id,
      title: `Room ${booking.room.roomNumber} - ${booking.guestName}`,
      start: booking.checkIn.toISOString(),
      end: displayEnd.toISOString(),
      resource: {
        bookingRef: booking.bookingRef,
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        roomNumber: booking.room.roomNumber,
        roomId: booking.room.id,
        status: booking.status,
      },
    };
  });

  return events;
}
