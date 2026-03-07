"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  RoomPerformanceData,
  DashboardStats,
  OccupancyData,
  RevenueData,
  BookingTrendData,
} from "@/types/report";

// Query key factory for reports
export const reportKeys = {
  all: ["reports"] as const,
  dashboard: () => [...reportKeys.all, "dashboard"] as const,
  occupancy: () => [...reportKeys.all, "occupancy"] as const,
  revenue: () => [...reportKeys.all, "revenue"] as const,
  bookingTrends: () => [...reportKeys.all, "bookingTrends"] as const,
  roomPerformance: () => [...reportKeys.all, "roomPerformance"] as const,
  roomPerformanceFiltered: (startDate?: string, endDate?: string) =>
    [...reportKeys.roomPerformance(), { startDate, endDate }] as const,
};

// Fetch dashboard stats
async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch("/api/reports?type=dashboard");
  if (!response.ok) {
    throw new Error("Failed to fetch dashboard stats");
  }
  return response.json();
}

// Fetch occupancy report
async function fetchOccupancyReport(): Promise<OccupancyData[]> {
  const response = await fetch("/api/reports?type=occupancy");
  if (!response.ok) {
    throw new Error("Failed to fetch occupancy report");
  }
  return response.json();
}

// Fetch revenue report
async function fetchRevenueReport(): Promise<RevenueData[]> {
  const response = await fetch("/api/reports?type=revenue");
  if (!response.ok) {
    throw new Error("Failed to fetch revenue report");
  }
  return response.json();
}

// Fetch booking trends
async function fetchBookingTrends(): Promise<BookingTrendData[]> {
  const response = await fetch("/api/reports?type=bookings");
  if (!response.ok) {
    throw new Error("Failed to fetch booking trends");
  }
  return response.json();
}

// Fetch room performance with optional date filter
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
 * Hook to fetch dashboard statistics
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: reportKeys.dashboard(),
    queryFn: fetchDashboardStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch occupancy report (last 6 months)
 */
export function useOccupancyReport() {
  return useQuery({
    queryKey: reportKeys.occupancy(),
    queryFn: fetchOccupancyReport,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to fetch revenue report (last 6 months)
 */
export function useRevenueReport() {
  return useQuery({
    queryKey: reportKeys.revenue(),
    queryFn: fetchRevenueReport,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to fetch booking trends (last 30 days)
 */
export function useBookingTrends() {
  return useQuery({
    queryKey: reportKeys.bookingTrends(),
    queryFn: fetchBookingTrends,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
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
