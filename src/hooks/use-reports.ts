"use client";

import { useQuery } from "@tanstack/react-query";
import type { RoomPerformanceData } from "@/types/report";

// Only the room-performance surface survives after the dead-slice
// sweep. Dashboard / occupancy / revenue / booking-trends
// hooks were unconsumed.
export const reportKeys = {
  all: ["reports"] as const,
  roomPerformance: () => [...reportKeys.all, "roomPerformance"] as const,
  roomPerformanceFiltered: (startDate?: string, endDate?: string) =>
    [...reportKeys.roomPerformance(), { startDate, endDate }] as const,
};

async function fetchRoomPerformance(
  startDate?: string,
  endDate?: string
): Promise<RoomPerformanceData[]> {
  const params = new URLSearchParams({ type: "rooms" });
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const response = await fetch(`/api/reports?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch room performance");
  }
  return response.json();
}

/**
 * Hook to fetch room performance with optional date filtering
 */
export function useRoomPerformance(
  initialData?: RoomPerformanceData[],
  startDate?: string,
  endDate?: string,
  initialDataUpdatedAt?: number
) {
  return useQuery({
    queryKey: reportKeys.roomPerformanceFiltered(startDate, endDate),
    queryFn: () => fetchRoomPerformance(startDate, endDate),
    initialData,
    initialDataUpdatedAt,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
