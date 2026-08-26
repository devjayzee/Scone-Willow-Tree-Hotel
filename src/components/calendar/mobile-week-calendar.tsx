"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  isSameWeek,
  isBefore,
} from "date-fns";
import { ChevronRight, Calendar } from "lucide-react";
import { getRoomColor } from "@/lib/constants/room-colors";
import { SLIDE_ANIMATION_MS } from "@/lib/constants/calendar";
import type { CalendarEvent } from "@/types/calendar";
import type { RoomSummary } from "@/types/room";

interface MobileWeekCalendarProps {
  date: Date;
  events: CalendarEvent[];
  rooms: RoomSummary[];
  onSelectEvent?: (event: CalendarEvent) => void;
}

export function MobileWeekCalendar({
  date,
  events,
  rooms,
  onSelectEvent,
}: MobileWeekCalendarProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const prevDateRef = useRef<Date>(date);

  // Detect navigation direction and trigger animation
  useEffect(() => {
    const prevDate = prevDateRef.current;
    if (prevDate && !isSameWeek(prevDate, date, { weekStartsOn: 1 })) {
      const direction = isBefore(date, prevDate) ? "right" : "left";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Animation trigger derived from `date` prop change plus a timer-based reset. Refactoring to a `key`-prop remount would lose scroll/focus state.
      setSlideDirection(direction);
      setIsAnimating(true);

      const timer = setTimeout(() => {
        setIsAnimating(false);
        setSlideDirection(null);
      }, SLIDE_ANIMATION_MS);

      return () => clearTimeout(timer);
    }
    prevDateRef.current = date;
  }, [date]);

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

  // Get bookings for a room this week
  const getRoomBookings = (roomNumber: string): { day: Date; event: CalendarEvent }[] => {
    const bookings: { day: Date; event: CalendarEvent }[] = [];
    for (const day of daysInWeek) {
      const booking = getBooking(roomNumber, day);
      if (booking) {
        bookings.push({ day, event: booking });
      }
    }
    return bookings;
  };

  // Animation class based on direction
  const getAnimationClass = () => {
    if (!isAnimating || !slideDirection) return "";
    return slideDirection === "left"
      ? "animate-slide-in-right"
      : "animate-slide-in-left";
  };

  return (
    <div className="space-y-4">
      {/* Week Header */}
      <div
        className={`bg-white rounded-lg border overflow-hidden ${getAnimationClass()}`}
        role="grid"
        aria-label={`Week of ${format(daysInWeek[0], "MMMM d")} to ${format(daysInWeek[6], "MMMM d, yyyy")}`}
      >
        <div className="grid grid-cols-7 divide-x" role="row">
          {daysInWeek.map((day) => {
            const isTodayDate = isToday(day);
            return (
              <div
                key={day.toISOString()}
                role="columnheader"
                aria-current={isTodayDate ? "date" : undefined}
                className={`py-3 text-center transition-colors duration-200 ${isTodayDate ? "bg-gold/20" : "bg-gray-50"}`}
              >
                <div className="text-xs text-gray-500 font-medium">
                  {format(day, "EEE")}
                </div>
                <div
                  className={`text-lg font-semibold transition-colors duration-200 ${
                    isTodayDate ? "text-gold" : "text-navy"
                  }`}
                >
                  {format(day, "d")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rooms List */}
      <div className="space-y-3" role="list" aria-label="Room bookings">
        {rooms.map((room, index) => {
          const colors = getRoomColor(room.roomNumber);
          const bookings = getRoomBookings(room.roomNumber);

          return (
            <article
              key={room.id}
              className={`bg-white rounded-lg border overflow-hidden transition-all duration-200 ${getAnimationClass()}`}
              style={{ animationDelay: `${index * 30}ms` }}
              aria-label={`Room ${room.roomNumber}, ${bookings.length} booking${bookings.length !== 1 ? "s" : ""} this week`}
            >
              {/* Room Header */}
              <div
                className="px-4 py-3 flex items-center gap-3 border-b transition-colors duration-200"
                style={{ backgroundColor: colors.bg }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-transform duration-200"
                  style={{ backgroundColor: colors.dot, color: "white" }}
                  aria-hidden="true"
                >
                  {room.roomNumber}
                </div>
                <div>
                  <div className="font-semibold" style={{ color: colors.text }}>
                    Room {room.roomNumber}
                  </div>
                  <div className="text-xs text-gray-600">
                    {room.capacity} {room.capacity === 1 ? "guest" : "guests"}
                  </div>
                </div>
                <div className="ml-auto text-sm text-gray-500">
                  {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Bookings */}
              {bookings.length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-400 text-center" role="status">
                  Available all week
                </div>
              ) : (
                <div className="divide-y" role="list">
                  {bookings.map(({ day, event }, bookingIndex) => (
                    <button
                      key={event.id}
                      onClick={() => onSelectEvent?.(event)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.99] transition-all duration-150 text-left animate-fade-slide-in"
                      style={{ animationDelay: `${(index * 30) + (bookingIndex * 20)}ms` }}
                      aria-label={`${format(day, "EEEE")}, ${event.resource.guestName}, ${event.resource.bookingRef}`}
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-500 w-24 flex-shrink-0">
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {format(day, "EEE")} {format(day, "d")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {event.resource.guestName}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {event.resource.bookingRef}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
