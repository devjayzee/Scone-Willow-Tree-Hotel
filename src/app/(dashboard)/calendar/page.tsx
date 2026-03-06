"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { enAU } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { BookingDetailsDialog } from "@/components/booking/booking-details-dialog";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";
import { toast } from "sonner";

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

type BookingStatus = "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

interface Room {
  id: string;
  roomNumber: string;
  roomType: string | null;
  pricePerNight: string | number;
  description: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    bookingRef: string;
    guestName: string;
    guestEmail: string;
    roomNumber: string;
    roomType: string | null;
    status: BookingStatus;
  };
}

interface Booking {
  id: string;
  bookingRef: string;
  guestName: string;
  guestDateOfBirth?: string | null;
  guestAddress?: string | null;
  guestEmail: string;
  guestPhone?: string | null;
  vehicleRego?: string | null;
  additionalGuests?: string | null;
  checkIn: string;
  checkInTime?: string | null;
  checkOut: string;
  checkOutTime?: string | null;
  bondDeposit?: string | number | null;
  status: BookingStatus;
  notes?: string | null;
  createdAt: string;
  room: {
    roomNumber: string;
    roomType: string | null;
    pricePerNight: string | number;
  };
  createdBy?: {
    firstName: string;
    lastName: string;
  };
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>("all");

  // Dialog states
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const start = startOfMonth(addMonths(date, -1));
      const end = endOfMonth(addMonths(date, 1));

      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });

      if (selectedRoom !== "all") {
        params.append("roomId", selectedRoom);
      }

      const response = await fetch(`/api/calendar?${params}`);
      if (!response.ok) throw new Error("Failed to fetch events");

      const data = await response.json();
      const formattedEvents = data.map((event: { id: string; title: string; start: string; end: string; resource: CalendarEvent["resource"] }) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      }));

      setEvents(formattedEvents);
    } catch (error) {
      console.error("Failed to fetch calendar events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [date, selectedRoom]);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      setRooms(data);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSelectEvent = async (event: CalendarEvent) => {
    try {
      const response = await fetch(`/api/bookings/${event.id}`);
      if (!response.ok) throw new Error("Failed to fetch booking");
      const booking = await response.json();
      setSelectedBooking(booking);
      setDetailsDialogOpen(true);
    } catch (error) {
      console.error("Failed to fetch booking details:", error);
    }
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setSelectedSlot({ start, end });
    setBookingDialogOpen(true);
  };

  const handleCreateBooking = async (data: {
    roomId: string;
    guestName: string;
    guestDateOfBirth?: string;
    guestAddress?: string;
    guestEmail: string;
    guestPhone?: string;
    vehicleRego?: string;
    additionalGuests?: string;
    checkIn: string;
    checkInTime?: string;
    checkOut: string;
    checkOutTime?: string;
    bondDeposit?: number;
    notes?: string;
  }) => {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create booking");
    }

    toast.success("Booking created successfully");
    setSelectedSlot(null);
    await fetchEvents();
  };

  const handleNavigate = (newDate: Date) => {
    setDate(newDate);
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
  };

  const eventStyleGetter = (event: CalendarEvent) => {
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
  };

  const CustomToolbar = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 p-4 bg-white rounded-lg border">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleNavigate(addMonths(date, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => handleNavigate(new Date())}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleNavigate(addMonths(date, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-navy ml-2">
          {format(date, "MMMM yyyy")}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedRoom} onValueChange={setSelectedRoom}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Filter by room" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rooms</SelectItem>
            {rooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                Room {room.roomNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex border rounded-md">
          <Button
            variant={view === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("month")}
            className="rounded-r-none"
          >
            Month
          </Button>
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("week")}
            className="rounded-none border-x"
          >
            Week
          </Button>
          <Button
            variant={view === "agenda" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("agenda")}
            className="rounded-l-none"
          >
            Agenda
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={fetchEvents}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Calendar</h1>
        <p className="text-muted-foreground">View and manage room availability</p>
      </div>

      <CustomToolbar />

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
          setBookingDialogOpen(open);
          if (!open) setSelectedSlot(null);
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
