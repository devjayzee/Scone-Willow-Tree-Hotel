"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useRoomPerformance } from "@/hooks/use-reports";
import { ReportsToolbar } from "@/components/report/reports-toolbar";
import { ReportsSummaryCards } from "@/components/report/reports-summary-cards";
import { RoomPerformanceCard } from "@/components/report/room-performance-card";
import type { RoomPerformanceData } from "@/types/report";

interface ReportsClientProps {
  initialData: RoomPerformanceData[];
  fetchTime?: number;
}

export function ReportsClient({ initialData, fetchTime }: ReportsClientProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Format dates for the query
  const startDate = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : undefined;
  const endDate = dateRange?.to
    ? format(dateRange.to, "yyyy-MM-dd")
    : undefined;

  // Check if we have a date filter applied
  const hasDateFilter = Boolean(startDate || endDate);

  // Use TanStack Query for data fetching
  // Only use initialData when there's no date filter (showing all-time data)
  const {
    data: roomPerformance = initialData,
    isLoading,
    isFetching,
    refetch,
  } = useRoomPerformance(
    hasDateFilter ? undefined : initialData,
    startDate,
    endDate,
    hasDateFilter ? undefined : fetchTime,
  );

  // Calculate totals
  const totals = useMemo(
    () =>
      roomPerformance.reduce(
        (acc, room) => ({
          totalBookings: acc.totalBookings + room.totalBookings,
          totalNights: acc.totalNights + room.totalNights,
          bookedRevenue: acc.bookedRevenue + room.bookedRevenue,
        }),
        { totalBookings: 0, totalNights: 0, bookedRevenue: 0 },
      ),
    [roomPerformance],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          View performance metrics and trends
        </p>
      </div>

      <ReportsToolbar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      <ReportsSummaryCards
        totalBookings={totals.totalBookings}
        totalNights={totals.totalNights}
        bookedRevenue={totals.bookedRevenue}
      />

      <RoomPerformanceCard
        roomPerformance={roomPerformance}
        isLoading={isLoading}
        totalBookings={totals.totalBookings}
        totalNights={totals.totalNights}
        bookedRevenue={totals.bookedRevenue}
      />
    </div>
  );
}
