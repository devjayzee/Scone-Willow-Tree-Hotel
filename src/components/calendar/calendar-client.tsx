"use client";

import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { CalendarViews } from "@/components/calendar/calendar-views";
import { BookingDetailsDialog } from "@/components/booking/booking-details-dialog";
import { useCalendarPageState } from "@/hooks/use-calendar-page-state";
import type { RoomSummary } from "@/types/room";
import type { CalendarEvent } from "@/types/calendar";

interface CalendarClientProps {
  initialEvents: CalendarEvent[];
  initialRooms: RoomSummary[];
  fetchTime?: number;
}

export function CalendarClient({
  initialEvents,
  initialRooms,
  fetchTime,
}: CalendarClientProps) {
  const {
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
  } = useCalendarPageState({ initialEvents, fetchTime });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Calendar</h1>
        <p className="text-muted-foreground">
          View room availability and bookings
        </p>
      </div>

      <CalendarToolbar
        date={date}
        view={view}
        onNavigate={handleNavigate}
        onViewChange={handleViewChange}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      {isLoading ? (
        <div className="bg-white rounded-lg border p-4">
          <CalendarSkeleton />
        </div>
      ) : (
        <CalendarViews
          view={view}
          date={date}
          events={events}
          localEvents={localEvents}
          rooms={initialRooms}
          onNavigate={handleNavigate}
          onSelectLocalEvent={handleSelectLocalEvent}
          onSelectCalendarEvent={handleSelectCalendarEvent}
        />
      )}

      <BookingDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        booking={selectedBooking}
      />
    </div>
  );
}
