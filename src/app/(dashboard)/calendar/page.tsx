import { getCalendarEvents } from "@/lib/services/calendar-service";
import { getAllRooms } from "@/lib/services/room-service";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

export default async function CalendarPage() {
  // Fetch initial data for the current month range
  const today = new Date();
  const start = startOfMonth(addMonths(today, -1));
  const end = endOfMonth(addMonths(today, 1));

  const [events, rooms] = await Promise.all([
    getCalendarEvents(start.toISOString(), end.toISOString()),
    getAllRooms(),
  ]);

  // Serialize rooms for client component
  const serializedRooms = rooms.map((room) => ({
    id: room.id,
    roomNumber: room.roomNumber,
    capacity: room.capacity,
    pricePerNight: Number(room.pricePerNight),
    description: room.description,
  }));

  return <CalendarClient initialEvents={events} initialRooms={serializedRooms} />;
}
