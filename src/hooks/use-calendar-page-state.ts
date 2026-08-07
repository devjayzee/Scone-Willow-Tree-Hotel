"use client";

import { useState, useCallback, useMemo } from "react";
import { addMonths, startOfMonth, endOfMonth } from "date-fns";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { useFetchBooking } from "@/hooks/booking";
import type { CalendarEvent } from "@/types/calendar";
import type { Booking } from "@/types/booking";

export type CalendarView = "month" | "week";

/**
 * Presentational shape with Date-typed start/end (react-big-calendar
 * doesn't accept ISO strings).
 */
export interface LocalCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEvent["resource"];
}

interface UseCalendarPageStateOptions {
  initialEvents: CalendarEvent[];
  fetchTime?: number;
}

/**
 * Container hook for the calendar dashboard — owns query, date window,
 * view switching, dialog state, and event-to-Date conversion. The
 * client component becomes a thin composition of leaves consuming this
 * hook's return.
 */
export function useCalendarPageState({
  initialEvents,
  fetchTime,
}: UseCalendarPageStateOptions) {
  const fetchBooking = useFetchBooking();

  // Calendar view + navigation state
  const [view, setView] = useState<CalendarView>("month");
  const [date, setDate] = useState(new Date());

  // Dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Query window (3 months back, 6 months ahead of the current view date)
  const startDate = useMemo(
    () => startOfMonth(addMonths(date, -3)).toISOString(),
    [date],
  );
  const endDate = useMemo(
    () => endOfMonth(addMonths(date, 6)).toISOString(),
    [date],
  );

  // Only pass initialData when the current query window matches what the
  // server rendered — otherwise we'd stamp SSR events onto a different range.
  const [initialDateRange] = useState(() => ({
    start: startDate,
    end: endDate,
  }));
  const isInitialRange =
    startDate === initialDateRange.start && endDate === initialDateRange.end;

  const {
    data: events = initialEvents,
    refetch,
    isLoading,
    isFetching,
  } = useCalendarEvents(
    isInitialRange ? initialEvents : undefined,
    startDate,
    endDate,
    undefined,
    isInitialRange ? fetchTime : undefined,
  );

  // react-big-calendar wants Date objects, not ISO strings.
  const localEvents: LocalCalendarEvent[] = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      })),
    [events],
  );

  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  const handleViewChange = useCallback((newView: CalendarView) => {
    setView(newView);
  }, []);

  const fetchAndShowBooking = useCallback(
    async (eventId: string) => {
      // Strip the ::yyyy-MM-dd suffix that multi-night events carry.
      const bookingId = eventId.includes("::")
        ? eventId.split("::")[0]
        : eventId;
      const booking = await fetchBooking(bookingId);
      if (booking) {
        setSelectedBooking(booking);
        setDetailsDialogOpen(true);
      }
    },
    [fetchBooking],
  );

  const handleSelectLocalEvent = useCallback(
    async (event: LocalCalendarEvent) => {
      await fetchAndShowBooking(event.id);
    },
    [fetchAndShowBooking],
  );

  const handleSelectCalendarEvent = useCallback(
    async (event: CalendarEvent) => {
      await fetchAndShowBooking(event.id);
    },
    [fetchAndShowBooking],
  );

  return {
    view,
    date,
    events,
    localEvents,
    isLoading,
    isFetching,
    refetch,
    detailsDialogOpen,
    selectedBooking,
    setDetailsDialogOpen,
    handleNavigate,
    handleViewChange,
    handleSelectLocalEvent,
    handleSelectCalendarEvent,
  };
}
