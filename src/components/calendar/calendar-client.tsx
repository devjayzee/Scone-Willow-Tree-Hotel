"use client";

import { useState, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { enAU } from "date-fns/locale";
import { toast } from "sonner";
import { RoomCalendar } from "@/components/calendar/room-calendar";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { BookingDetailsDialog } from "@/components/booking/booking-details-dialog";
import { useCalendarEvents } from "@/hooks/use-calendar";
import type { RoomSummary } from "@/types/room";
import type { CalendarEvent } from "@/types/calendar";
import type { Booking } from "@/types/booking";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

const locales = {
  "en-AU": enAU,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Color palette for rooms
const roomColors: Record<string, { bg: string; text: string }> = {
  "1": { bg: "#fef3c7", text: "#92400e" },
  "2": { bg: "#dbeafe", text: "#1e40af" },
  "3": { bg: "#dcfce7", text: "#166534" },
  "4": { bg: "#fce7f3", text: "#9d174d" },
  "5": { bg: "#e0e7ff", text: "#3730a3" },
  "6": { bg: "#fed7aa", text: "#c2410c" },
  "7": { bg: "#d1fae5", text: "#065f46" },
  "8": { bg: "#fae8ff", text: "#86198f" },
};

type ViewType = "month" | "week";

interface CalendarClientProps {
  initialEvents: CalendarEvent[];
  initialRooms: RoomSummary[];
}

// Local calendar event type with Date objects
interface LocalCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEvent["resource"];
}

export function CalendarClient({
  initialEvents,
  initialRooms,
}: CalendarClientProps) {
  // Calendar state
  const [view, setView] = useState<ViewType>("month");
  const [date, setDate] = useState(new Date());

  // Dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Calculate date range for query
  const startDate = useMemo(
    () => startOfMonth(addMonths(date, -1)).toISOString(),
    [date]
  );
  const endDate = useMemo(
    () => endOfMonth(addMonths(date, 1)).toISOString(),
    [date]
  );

  // TanStack Query for calendar events
  const { data: events = initialEvents } = useCalendarEvents(
    initialEvents,
    startDate,
    endDate
  );

  // Convert events from ISO strings to Date objects for react-big-calendar
  const localEvents: LocalCalendarEvent[] = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      })),
    [events]
  );

  // Navigation handlers
  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  const handleViewChange = useCallback((newView: ViewType) => {
    setView(newView);
  }, []);

  // Event selection handler for monthly view
  const handleSelectEvent = useCallback(async (event: LocalCalendarEvent) => {
    await fetchAndShowBooking(event.id);
  }, []);

  // Event selection handler for weekly view
  const handleSelectCalendarEvent = useCallback(async (event: CalendarEvent) => {
    await fetchAndShowBooking(event.id);
  }, []);

  // Fetch booking details and show dialog
  const fetchAndShowBooking = async (eventId: string) => {
    try {
      // Extract the original booking ID (remove date suffix if present)
      const bookingId = eventId.includes("::")
        ? eventId.split("::")[0]
        : eventId;

      const response = await fetch(`/api/bookings/${bookingId}`);
      if (!response.ok) throw new Error("Failed to fetch booking");
      const booking = await response.json();
      setSelectedBooking(booking);
      setDetailsDialogOpen(true);
    } catch (error) {
      console.error("Failed to fetch booking details:", error);
      toast.error("Failed to fetch booking details");
    }
  };

  // Event styling for monthly view
  const eventStyleGetter = useCallback((event: LocalCalendarEvent) => {
    const roomNumber = event.resource.roomNumber;
    const colors = roomColors[roomNumber] || { bg: "#f3f4f6", text: "#374151" };

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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Calendar</h1>
        <p className="text-muted-foreground">
          View room availability and bookings
        </p>
      </div>

      {/* Toolbar */}
      <CalendarToolbar
        date={date}
        view={view}
        onNavigate={handleNavigate}
        onViewChange={handleViewChange}
      />

      {/* Calendar Views */}
      <div className="bg-white rounded-lg border p-4">
        {view === "month" ? (
          <div style={{ minHeight: "700px" }}>
            <Calendar
              localizer={localizer}
              events={localEvents}
              startAccessor="start"
              endAccessor="end"
              view="month"
              date={date}
              onNavigate={handleNavigate}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              toolbar={false}
              showAllEvents
              style={{ minHeight: "650px" }}
            />
          </div>
        ) : (
          <RoomCalendar
            date={date}
            events={events}
            rooms={initialRooms}
            onSelectEvent={handleSelectCalendarEvent}
          />
        )}
      </div>

      <BookingDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        booking={selectedBooking}
      />
    </div>
  );
}
