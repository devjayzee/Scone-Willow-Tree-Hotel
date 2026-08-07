"use client";

import { useCallback } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enAU } from "date-fns/locale";
import { getRoomColor } from "@/lib/constants/room-colors";
import type { LocalCalendarEvent } from "@/hooks/use-calendar-page-state";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-AU": enAU },
});

interface CalendarMonthViewProps {
  events: LocalCalendarEvent[];
  date: Date;
  onNavigate: (date: Date) => void;
  onSelectEvent: (event: LocalCalendarEvent) => void;
}

/**
 * Presentational react-big-calendar month view. Owns the localizer, the
 * imported CSS, and the room-colored event styling. No hooks beyond
 * `useCallback` for the style getter.
 */
export function CalendarMonthView({
  events,
  date,
  onNavigate,
  onSelectEvent,
}: CalendarMonthViewProps) {
  const eventStyleGetter = useCallback((event: LocalCalendarEvent) => {
    const colors = getRoomColor(event.resource.roomNumber);
    return {
      style: {
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: "4px",
        border: "none",
        fontSize: "11px",
        fontWeight: "500",
      },
    };
  }, []);

  return (
    <div style={{ minHeight: "700px" }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view="month"
        date={date}
        onNavigate={onNavigate}
        onSelectEvent={onSelectEvent}
        eventPropGetter={eventStyleGetter}
        toolbar={false}
        showAllEvents
        style={{ minHeight: "650px" }}
      />
    </div>
  );
}
