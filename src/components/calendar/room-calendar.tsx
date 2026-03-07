"use client";

import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
} from "date-fns";
import type { CalendarEvent } from "@/types/calendar";
import type { RoomSummary } from "@/types/room";

// Color palette for rooms
const roomColors: Record<string, { bg: string; text: string; border: string }> = {
  "1": { bg: "#fef3c7", text: "#92400e", border: "#f59e0b" },
  "2": { bg: "#dbeafe", text: "#1e40af", border: "#3b82f6" },
  "3": { bg: "#dcfce7", text: "#166534", border: "#22c55e" },
  "4": { bg: "#fce7f3", text: "#9d174d", border: "#ec4899" },
  "5": { bg: "#e0e7ff", text: "#3730a3", border: "#6366f1" },
  "6": { bg: "#fed7aa", text: "#c2410c", border: "#f97316" },
  "7": { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
  "8": { bg: "#fae8ff", text: "#86198f", border: "#d946ef" },
};

interface RoomCalendarProps {
  date: Date;
  events: CalendarEvent[];
  rooms: RoomSummary[];
  onSelectEvent?: (event: CalendarEvent) => void;
}

export function RoomCalendar({
  date,
  events,
  rooms,
  onSelectEvent,
}: RoomCalendarProps) {
  // Get all days in the current week (Monday to Sunday)
  const daysInWeek = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [date]);

  // Create a lookup map for bookings by room and date
  const bookingMap = useMemo(() => {
    const map = new Map<string, CalendarEvent>();

    for (const event of events) {
      const eventDate = new Date(event.start);
      const key = `${event.resource.roomNumber}-${format(eventDate, "yyyy-MM-dd")}`;
      map.set(key, event);
    }

    return map;
  }, [events]);

  // Get booking for a specific room and date
  const getBooking = (roomNumber: string, day: Date): CalendarEvent | undefined => {
    const key = `${roomNumber}-${format(day, "yyyy-MM-dd")}`;
    return bookingMap.get(key);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-4 py-3 text-left font-semibold text-navy w-[140px]">
              Room
            </th>
            {daysInWeek.map((day) => (
              <th
                key={day.toISOString()}
                className={`border border-gray-200 px-2 py-3 text-center font-medium min-w-[120px] ${
                  isToday(day) ? "bg-gold/20" : "bg-gray-50"
                }`}
              >
                <div className="text-navy text-sm">{format(day, "EEE")}</div>
                <div className={`text-xl ${isToday(day) ? "text-gold font-bold" : "text-gray-700"}`}>
                  {format(day, "d")}
                </div>
                <div className="text-xs text-gray-500">{format(day, "MMM")}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const colors = roomColors[room.roomNumber] || {
              bg: "#f3f4f6",
              text: "#374151",
              border: "#9ca3af",
            };

            return (
              <tr key={room.id}>
                <td
                  className="sticky left-0 z-10 border border-gray-200 px-4 py-4 font-medium text-navy"
                  style={{ backgroundColor: colors.bg }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: colors.border }}
                    />
                    <div>
                      <div className="font-semibold">Room {room.roomNumber}</div>
                      <div className="text-xs text-gray-600 font-normal">
                        {room.capacity} {room.capacity === 1 ? "guest" : "guests"}
                      </div>
                    </div>
                  </div>
                </td>
                {daysInWeek.map((day) => {
                  const booking = getBooking(room.roomNumber, day);
                  const isTodayCell = isToday(day);

                  if (booking) {
                    return (
                      <td
                        key={day.toISOString()}
                        className="border border-gray-200 p-2 cursor-pointer transition-all hover:opacity-80 h-[80px] align-top"
                        style={{
                          backgroundColor: colors.bg,
                          borderLeft: `4px solid ${colors.border}`,
                        }}
                        onClick={() => onSelectEvent?.(booking)}
                        title={`${booking.resource.guestName}\n${booking.resource.bookingRef}`}
                      >
                        <div
                          className="text-sm font-semibold truncate"
                          style={{ color: colors.text }}
                        >
                          {booking.resource.guestName}
                        </div>
                        <div
                          className="text-xs mt-1 opacity-75"
                          style={{ color: colors.text }}
                        >
                          {booking.resource.bookingRef}
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={day.toISOString()}
                      className={`border border-gray-200 p-2 h-[80px] ${
                        isTodayCell ? "bg-gold/10" : "bg-white"
                      }`}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
