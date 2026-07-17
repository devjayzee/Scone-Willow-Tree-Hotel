"use client";

import { useState, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  addMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { enAU } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";
import { RoomCalendar } from "@/components/calendar/room-calendar";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { MobileCalendar } from "@/components/calendar/mobile-calendar";
import { MobileWeekCalendar } from "@/components/calendar/mobile-week-calendar";
import { BookingDetailsDialog } from "@/components/booking/booking-details-dialog";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { bookingKeys, fetchBookingById } from "@/hooks/booking";
import type { RoomSummary } from "@/types/room";
import type { CalendarEvent } from "@/types/calendar";
import type { Booking } from "@/types/booking";
import { getRoomColor } from "@/lib/constants/room-colors";
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

type ViewType = "month" | "week";

interface CalendarClientProps {
  initialEvents: CalendarEvent[];
  initialRooms: RoomSummary[];
  fetchTime?: number;
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
  fetchTime,
}: CalendarClientProps) {
  const queryClient = useQueryClient();

  // Calendar state
  const [view, setView] = useState<ViewType>("month");
  const [date, setDate] = useState(new Date());

  // Dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Calculate date range for query (3 months back, 6 months ahead from current view)
  const startDate = useMemo(
    () => startOfMonth(addMonths(date, -3)).toISOString(),
    [date],
  );
  const endDate = useMemo(
    () => endOfMonth(addMonths(date, 6)).toISOString(),
    [date],
  );

  // Track initial date range to only use initialData for matching queries
  const [initialDateRange] = useState(() => ({
    start: startDate,
    end: endDate,
  }));
  const isInitialRange =
    startDate === initialDateRange.start && endDate === initialDateRange.end;

  // TanStack Query for calendar events
  // Only pass initialData when on the initial date range to avoid stale data
  const {
    data: events = initialEvents,
    refetch,
    isLoading,
    isFetching,
  } = useCalendarEvents(
    isInitialRange ? initialEvents : undefined,
    startDate,
    endDate,
    undefined, // roomId
    isInitialRange ? fetchTime : undefined,
  );

  // Convert events from ISO strings to Date objects for react-big-calendar
  const localEvents: LocalCalendarEvent[] = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      })),
    [events],
  );

  // Navigation handlers
  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  const handleViewChange = useCallback((newView: ViewType) => {
    setView(newView);
  }, []);

  // Fetch booking details and show dialog
  const fetchAndShowBooking = useCallback(
    async (eventId: string) => {
      // Extract the original booking ID (remove date suffix if present)
      const bookingId = eventId.includes("::")
        ? eventId.split("::")[0]
        : eventId;

      try {
        const booking = await queryClient.fetchQuery({
          queryKey: bookingKeys.detail(bookingId),
          queryFn: () => fetchBookingById(bookingId),
          staleTime: 1000 * 30,
        });
        setSelectedBooking(booking);
        setDetailsDialogOpen(true);
      } catch (error) {
        logger.error("Failed to fetch booking details", error, { eventId });
        toast.error("Failed to fetch booking details");
      }
    },
    [queryClient],
  );

  // Event selection handler for monthly view
  const handleSelectEvent = useCallback(
    async (event: LocalCalendarEvent) => {
      await fetchAndShowBooking(event.id);
    },
    [fetchAndShowBooking],
  );

  // Event selection handler for weekly view
  const handleSelectCalendarEvent = useCallback(
    async (event: CalendarEvent) => {
      await fetchAndShowBooking(event.id);
    },
    [fetchAndShowBooking],
  );

  // Event styling for monthly view
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
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      {/* Calendar Views */}
      {isLoading ? (
        <div className="bg-white rounded-lg border p-4">
          <CalendarSkeleton />
        </div>
      ) : (
        <>
          {/* Mobile Calendar Views */}
          <div className="md:hidden">
            {view === "month" ? (
              <MobileCalendar
                date={date}
                events={events}
                onSelectEvent={handleSelectCalendarEvent}
              />
            ) : (
              <MobileWeekCalendar
                date={date}
                events={events}
                rooms={initialRooms}
                onSelectEvent={handleSelectCalendarEvent}
              />
            )}
          </div>

          {/* Desktop Calendar Views */}
          <div className="hidden md:block bg-white rounded-lg border p-4">
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
        </>
      )}

      <BookingDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        booking={selectedBooking}
      />
    </div>
  );
}
