"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarEvent } from "@/types/calendar";

// Query key factory for calendar
export const calendarKeys = {
  all: ["calendar"] as const,
  events: () => [...calendarKeys.all, "events"] as const,
  eventsFiltered: (startDate?: string, endDate?: string, roomId?: string) =>
    [...calendarKeys.events(), { startDate, endDate, roomId }] as const,
};

// Fetch calendar events with optional filtering
async function fetchCalendarEvents(
  startDate?: string,
  endDate?: string,
  roomId?: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();

  if (startDate) params.append("start", startDate);
  if (endDate) params.append("end", endDate);
  if (roomId && roomId !== "all") params.append("roomId", roomId);

  const response = await fetch(`/api/calendar?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch calendar events");
  }
  return response.json();
}

/**
 * Hook to fetch calendar events with optional date range and room filtering
 */
export function useCalendarEvents(
  initialData?: CalendarEvent[],
  startDate?: string,
  endDate?: string,
  roomId?: string
) {
  return useQuery({
    queryKey: calendarKeys.eventsFiltered(startDate, endDate, roomId),
    queryFn: () => fetchCalendarEvents(startDate, endDate, roomId),
    initialData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to invalidate calendar events cache
 */
export function useInvalidateCalendarEvents() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
  };
}
