"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronRight } from "lucide-react";
import { getRoomColor } from "@/lib/constants/room-colors";
import { useSlideDirection } from "@/hooks/use-slide-direction";
import type { CalendarEvent } from "@/types/calendar";

interface MobileCalendarProps {
  date: Date;
  events: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
}

function hasMonthChanged(previous: Date, current: Date): boolean {
  return !isSameMonth(previous, current);
}

export function MobileCalendar({
  date,
  events,
  onSelectEvent,
}: MobileCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const animationClass = useSlideDirection(date, hasMonthChanged);

  // Get calendar grid days (includes prev/next month days to fill the grid)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [date]);

  // Create a lookup map for events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const dateKey = format(new Date(event.start), "yyyy-MM-dd");
      const existing = map.get(dateKey) || [];
      existing.push(event);
      map.set(dateKey, existing);
    }
    return map;
  }, [events]);

  // Get events for a specific date
  const getEventsForDate = (day: Date): CalendarEvent[] => {
    const key = format(day, "yyyy-MM-dd");
    return eventsByDate.get(key) || [];
  };

  // Get unique room numbers for date (for dots)
  const getRoomDotsForDate = (day: Date): string[] => {
    const dayEvents = getEventsForDate(day);
    const uniqueRooms = [...new Set(dayEvents.map(e => e.resource.roomNumber))];
    return uniqueRooms.slice(0, 4); // Max 4 dots
  };

  // Events for selected date
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-4">
      {/* Calendar Grid */}
      <div className="bg-white rounded-lg border overflow-hidden" role="grid" aria-label="Calendar">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b" role="row">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-gray-500"
              role="columnheader"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days with Animation */}
        <div className={`grid grid-cols-7 ${animationClass}`} role="rowgroup">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, date);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const roomDots = getRoomDotsForDate(day);
            const hasEvents = roomDots.length > 0;
            const bookingCount = getEventsForDate(day).length;

            return (
              <button
                key={index}
                onClick={() => setSelectedDate(day)}
                role="gridcell"
                aria-selected={isSelected || undefined}
                aria-label={`${format(day, "EEEE, MMMM d, yyyy")}${hasEvents ? `, ${bookingCount} booking${bookingCount !== 1 ? "s" : ""}` : ""}`}
                aria-current={isTodayDate ? "date" : undefined}
                className={`
                  relative min-h-[56px] p-1 border-b border-r border-gray-100
                  flex flex-col items-center justify-start pt-2
                  transition-all duration-150
                  ${!isCurrentMonth ? "bg-gray-50/50" : "bg-white"}
                  ${isSelected ? "bg-gold/20 ring-2 ring-gold ring-inset scale-105 z-10" : ""}
                  ${isTodayDate && !isSelected ? "bg-gold/10" : ""}
                  active:scale-95
                `}
              >
                <span
                  className={`
                    text-sm font-medium transition-transform duration-150
                    ${!isCurrentMonth ? "text-gray-300" : "text-gray-900"}
                    ${isTodayDate ? "bg-navy text-white rounded-full w-6 h-6 flex items-center justify-center" : ""}
                  `}
                >
                  {format(day, "d")}
                </span>

                {/* Booking Dots */}
                {hasEvents && isCurrentMonth && (
                  <div className="flex flex-wrap justify-center gap-0.5 mt-1 max-w-[40px]" aria-hidden="true">
                    {roomDots.map((roomNumber) => {
                      const colors = getRoomColor(roomNumber);
                      return (
                        <div
                          key={roomNumber}
                          className="w-2 h-2 rounded-full transition-transform duration-150"
                          style={{ backgroundColor: colors.dot }}
                        />
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Bookings */}
      {selectedDate && (
        <div className="bg-white rounded-lg border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-semibold text-navy">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </h3>
            <p className="text-sm text-gray-500">
              {selectedDateEvents.length} booking{selectedDateEvents.length !== 1 ? "s" : ""}
            </p>
          </div>

          {selectedDateEvents.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500" role="status">
              No bookings for this date
            </div>
          ) : (
            <div className="divide-y" role="list" aria-label="Bookings for selected date">
              {selectedDateEvents.map((event, index) => {
                const colors = getRoomColor(event.resource.roomNumber);
                return (
                  <button
                    key={event.id}
                    onClick={() => onSelectEvent?.(event)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.99] transition-all duration-150 text-left animate-fade-slide-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                    aria-label={`Room ${event.resource.roomNumber}, ${event.resource.guestName}, ${event.resource.bookingRef}`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: colors.bg, color: colors.dot }}
                      aria-hidden="true"
                    >
                      {event.resource.roomNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {event.resource.guestName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {event.resource.bookingRef}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Prompt to select a date */}
      {!selectedDate && (
        <div className="bg-white rounded-lg border px-4 py-8 text-center text-gray-500 animate-in fade-in duration-300">
          Tap a date to view bookings
        </div>
      )}
    </div>
  );
}
