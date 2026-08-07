"use client";

import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { RoomCalendar } from "@/components/calendar/room-calendar";
import { MobileCalendar } from "@/components/calendar/mobile-calendar";
import { MobileWeekCalendar } from "@/components/calendar/mobile-week-calendar";
import type {
  CalendarView,
  LocalCalendarEvent,
} from "@/hooks/use-calendar-page-state";
import type { CalendarEvent } from "@/types/calendar";
import type { RoomSummary } from "@/types/room";

interface CalendarViewsProps {
  view: CalendarView;
  date: Date;
  events: CalendarEvent[];
  localEvents: LocalCalendarEvent[];
  rooms: RoomSummary[];
  onNavigate: (date: Date) => void;
  onSelectLocalEvent: (event: LocalCalendarEvent) => void;
  onSelectCalendarEvent: (event: CalendarEvent) => void;
}

/**
 * Renders the responsive calendar: mobile stack under `md`, desktop
 * card view from `md` up. Each pair (mobile/desktop) picks the right
 * leaf for the current `view` (month vs. week/rooms).
 */
export function CalendarViews({
  view,
  date,
  events,
  localEvents,
  rooms,
  onNavigate,
  onSelectLocalEvent,
  onSelectCalendarEvent,
}: CalendarViewsProps) {
  return (
    <>
      {/* Mobile Calendar Views */}
      <div className="md:hidden">
        {view === "month" ? (
          <MobileCalendar
            date={date}
            events={events}
            onSelectEvent={onSelectCalendarEvent}
          />
        ) : (
          <MobileWeekCalendar
            date={date}
            events={events}
            rooms={rooms}
            onSelectEvent={onSelectCalendarEvent}
          />
        )}
      </div>

      {/* Desktop Calendar Views */}
      <div className="hidden md:block bg-white rounded-lg border p-4">
        {view === "month" ? (
          <CalendarMonthView
            events={localEvents}
            date={date}
            onNavigate={onNavigate}
            onSelectEvent={onSelectLocalEvent}
          />
        ) : (
          <RoomCalendar
            date={date}
            events={events}
            rooms={rooms}
            onSelectEvent={onSelectCalendarEvent}
          />
        )}
      </div>
    </>
  );
}
