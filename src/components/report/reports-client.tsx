"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useRoomPerformance } from "@/hooks/use-reports";
import { exportToCSV } from "@/lib/utils/csv-export";
import type { RoomPerformanceData } from "@/types/report";

interface ReportsClientProps {
  initialData: RoomPerformanceData[];
}

export function ReportsClient({ initialData }: ReportsClientProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Format dates for the query
  const startDate = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : undefined;
  const endDate = dateRange?.to
    ? format(dateRange.to, "yyyy-MM-dd")
    : undefined;

  // Use TanStack Query for data fetching
  const { data: roomPerformance = initialData, isLoading, refetch } = useRoomPerformance(
    initialData,
    startDate,
    endDate
  );

  // Calculate totals
  const totals = useMemo(
    () =>
      roomPerformance.reduce(
        (acc, room) => ({
          totalBookings: acc.totalBookings + room.totalBookings,
          totalNights: acc.totalNights + room.totalNights,
          totalRevenue: acc.totalRevenue + room.totalRevenue,
        }),
        { totalBookings: 0, totalNights: 0, totalRevenue: 0 }
      ),
    [roomPerformance]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            View performance metrics and trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Room Performance Table */}
      <Card className="bg-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-navy">Room Performance</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(roomPerformance, "room-performance")}
            disabled={roomPerformance.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-navy" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm font-medium text-gray-500">
                    <th className="text-left py-3 px-4">Room</th>
                    <th className="text-right py-3 px-4">Rate/Night</th>
                    <th className="text-right py-3 px-4">Total Bookings</th>
                    <th className="text-right py-3 px-4">Total Nights</th>
                    <th className="text-right py-3 px-4">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {roomPerformance.map((room) => (
                    <tr key={room.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">
                        Room {room.roomNumber}
                      </td>
                      <td className="py-3 px-4 text-right">
                        ${room.pricePerNight}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {room.totalBookings}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {room.totalNights}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600">
                        ${room.totalRevenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-gray-50 font-semibold">
                    <td colSpan={2} className="py-3 px-4">
                      Total
                    </td>
                    <td className="py-3 px-4 text-right">
                      {totals.totalBookings}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {totals.totalNights}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600">
                      ${totals.totalRevenue.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
