"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface RoomPerformanceData {
  id: string;
  roomNumber: string;
  pricePerNight: number;
  totalBookings: number;
  totalNights: number;
  totalRevenue: number;
}

export default function ReportsPage() {
  const [roomPerformance, setRoomPerformance] = useState<RoomPerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ type: "rooms" });

      if (dateRange?.from) {
        params.append("startDate", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange?.to) {
        params.append("endDate", format(dateRange.to, "yyyy-MM-dd"));
      }

      const rooms = await fetch(`/api/reports?${params.toString()}`).then((r) => r.json());
      setRoomPerformance(rooms);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const exportToCSV = (data: object[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]).filter((key) => key !== "id");
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((header) => (row as Record<string, unknown>)[header]).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

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
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
        />
      </div>

      {/* Room Performance Table */}
      <Card className="bg-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-navy">Room Performance</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(roomPerformance, "room-performance")}
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
                      <td className="py-3 px-4 text-right">{room.totalNights}</td>
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
                      {roomPerformance.reduce((sum, r) => sum + r.totalBookings, 0)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {roomPerformance.reduce((sum, r) => sum + r.totalNights, 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600">
                      $
                      {roomPerformance
                        .reduce((sum, r) => sum + r.totalRevenue, 0)
                        .toLocaleString()}
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
