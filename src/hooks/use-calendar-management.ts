"use client";

import { useState, useCallback, useMemo } from "react";
import { View } from "react-big-calendar";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
import { toast } from "sonner";
import { useCalendarEvents, useInvalidateCalendarEvents } from "@/hooks/use-calendar";
import { useCreateBooking } from "@/hooks/use-bookings";
import type { CalendarEvent as CalendarEventType } from "@/types/calendar";
import type { RoomSummary } from "@/types/room";
import type { Booking, CreateBookingInput } from "@/types/booking";

// Local calendar event type with Date objects
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEventType["resource"];
}

interface UseCalendarManagementOptions {
  initialEvents: CalendarEventType[];
  initialRooms: RoomSummary[];
}

export function useCalendarManagement({
  initialEvents,
  initialRooms,
}: UseCalendarManagementOptions) {
  // Calendar view state
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>("all");

  // Dialog states
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

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
  const {
    data: calendarEvents = initialEvents,
    isLoading,
    isFetching,
    refetch,
  } = useCalendarEvents(
    initialEvents,
    startDate,
    endDate,
    selectedRoom !== "all" ? selectedRoom : undefined
  );

  // Cache invalidation
  const invalidateCalendar = useInvalidateCalendarEvents();

  // Use existing booking mutation hook (with optimistic updates)
  const createBookingMutation = useCreateBooking();

  // Convert events from ISO strings to Date objects for react-big-calendar
  const events: CalendarEvent[] = useMemo(
    () =>
      calendarEvents.map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      })),
    [calendarEvents]
  );

  // Derived state
  const isRefreshing = isLoading || isFetching;
  const isCreatingBooking = createBookingMutation.isPending;

  // Navigation handlers
  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
  }, []);

  const handleRoomChange = useCallback((roomId: string) => {
    setSelectedRoom(roomId);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Event selection handler
  const handleSelectEvent = useCallback(async (event: CalendarEvent) => {
    try {
      const response = await fetch(`/api/bookings/${event.id}`);
      if (!response.ok) throw new Error("Failed to fetch booking");
      const booking = await response.json();
      setSelectedBooking(booking);
      setDetailsDialogOpen(true);
    } catch (error) {
      console.error("Failed to fetch booking details:", error);
      toast.error("Failed to fetch booking details");
    }
  }, []);

  // Slot selection handler (for creating new bookings)
  const handleSelectSlot = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      setSelectedSlot({ start, end });
      setBookingDialogOpen(true);
    },
    []
  );

  // Create booking handler using existing booking mutation
  const handleCreateBooking = useCallback(
    async (data: CreateBookingInput) => {
      await createBookingMutation.mutateAsync(data);
      // Close dialog and clear slot
      setSelectedSlot(null);
      setBookingDialogOpen(false);
      // Invalidate calendar cache to refetch events
      invalidateCalendar();
    },
    [createBookingMutation, invalidateCalendar]
  );

  // Dialog handlers
  const closeBookingDialog = useCallback(() => {
    setBookingDialogOpen(false);
    setSelectedSlot(null);
  }, []);

  const closeDetailsDialog = useCallback(() => {
    setDetailsDialogOpen(false);
    setSelectedBooking(null);
  }, []);

  // Event styling
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    let backgroundColor = "#1e3a5f"; // Navy - default for confirmed
    let borderColor = "#1e3a5f";

    if (event.resource.status === "CHECKED_IN") {
      backgroundColor = "#059669"; // Emerald
      borderColor = "#059669";
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: `1px solid ${borderColor}`,
        display: "block",
      },
    };
  }, []);

  return {
    // Data
    events,
    rooms: initialRooms,

    // View state
    view,
    date,
    selectedRoom,

    // Loading state
    isRefreshing,
    isCreatingBooking,

    // Dialog state
    bookingDialogOpen,
    detailsDialogOpen,
    selectedBooking,
    selectedSlot,

    // Navigation handlers
    handleNavigate,
    handleViewChange,
    handleRoomChange,
    handleRefresh,

    // Event handlers
    handleSelectEvent,
    handleSelectSlot,
    handleCreateBooking,

    // Dialog handlers
    closeBookingDialog,
    closeDetailsDialog,
    setBookingDialogOpen,
    setDetailsDialogOpen,

    // Styling
    eventStyleGetter,
  };
}
