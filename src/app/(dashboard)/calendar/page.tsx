import { requireSession } from "@/lib/auth-guard";
import { getCalendarEvents } from "@/lib/services/calendar-service";
import { getAllRooms } from "@/lib/services/room-service";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
import {
  CALENDAR_PREFETCH_MONTHS_BACK,
  CALENDAR_PREFETCH_MONTHS_AHEAD,
} from "@/lib/constants/calendar";
import { serializeRoom } from "@/lib/utils/serialize";

// Disable caching - always fetch fresh data
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  // Track when data was fetched for cache freshness
  const fetchTime = Date.now();

  await requireSession();

  // Fetch initial data for a wider range (3 months back, 6 months ahead)
  const today = new Date();
  const start = startOfMonth(addMonths(today, -CALENDAR_PREFETCH_MONTHS_BACK));
  const end = endOfMonth(addMonths(today, CALENDAR_PREFETCH_MONTHS_AHEAD));

  const [events, rooms] = await Promise.all([
    getCalendarEvents(start, end),
    getAllRooms(),
  ]);

  // Serialize rooms for client component
  const serializedRooms = rooms.map(serializeRoom);

  return (
    <CalendarClient
      initialEvents={events}
      initialRooms={serializedRooms}
      fetchTime={fetchTime}
    />
  );
}
