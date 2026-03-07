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
  // Create individual day events for each night of the stay
  // This shows bookings as blocks within each day cell instead of spanning bars
  const events: CalendarEvent[] = [];

  for (const booking of bookings) {
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);

    // Create an event for each night of the stay
    const currentDate = new Date(checkIn);
    while (currentDate < checkOut) {
      // Set event times (e.g., 2pm check-in style display)
      const eventStart = new Date(currentDate);
      eventStart.setHours(14, 0, 0, 0);

      const eventEnd = new Date(currentDate);
      eventEnd.setHours(16, 0, 0, 0);

      events.push({
        id: `${booking.id}::${currentDate.toISOString().split("T")[0]}`,
        title: `Room ${booking.room.roomNumber} - ${booking.guestName}`,
        start: eventStart.toISOString(),
        end: eventEnd.toISOString(),
        resource: {
          bookingRef: booking.bookingRef,
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          roomNumber: booking.room.roomNumber,
          roomId: booking.room.id,
          status: booking.status,
        },
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return events;
}
