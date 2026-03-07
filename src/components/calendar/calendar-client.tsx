"use client";

import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enAU } from "date-fns/locale";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { BookingDetailsDialog } from "@/components/booking/booking-details-dialog";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { useCalendarManagement } from "@/hooks/use-calendar-management";
import type { RoomSummary } from "@/types/room";
import type { CalendarEvent as CalendarEventType } from "@/types/calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/app/(dashboard)/calendar/calendar.css";

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

interface CalendarClientProps {
  initialEvents: CalendarEventType[];
  initialRooms: RoomSummary[];
}

export function CalendarClient({
  initialEvents,
  initialRooms,
}: CalendarClientProps) {
  const {
    // Data
    events,
    rooms,

    // View state
    view,
    date,
    selectedRoom,

    // Loading state
    isRefreshing,

    // Dialog state
    bookingDialogOpen,
    detailsDialogOpen,
    selectedBooking,

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
    setDetailsDialogOpen,

    // Styling
    eventStyleGetter,
  } = useCalendarManagement({ initialEvents, initialRooms });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Calendar</h1>
        <p className="text-muted-foreground">
          View and manage room availability
        </p>
      </div>

      {/* Toolbar */}
      <CalendarToolbar
        date={date}
        view={view}
        selectedRoom={selectedRoom}
        rooms={rooms}
        isRefreshing={isRefreshing}
        onNavigate={handleNavigate}
        onViewChange={handleViewChange}
        onRoomChange={handleRoomChange}
        onRefresh={handleRefresh}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-lg border text-sm">
        <span className="text-muted-foreground">Legend:</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-navy"></span>
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-emerald-600"></span>
          <span>Checked In</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg border p-4" style={{ height: "600px" }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          date={date}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          eventPropGetter={eventStyleGetter}
          toolbar={false}
          popup
          views={["month", "week", "agenda"]}
          style={{ height: "100%" }}
        />
      </div>

      <BookingDialog
        open={bookingDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeBookingDialog();
        }}
        rooms={rooms}
        onSubmit={handleCreateBooking}
      />

      <BookingDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        booking={selectedBooking}
      />
    </div>
  );
}
