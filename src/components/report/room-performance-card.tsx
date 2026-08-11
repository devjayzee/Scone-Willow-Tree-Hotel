"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import { exportToCSV } from "@/lib/utils/csv-export";
import { ReportTableSkeleton } from "@/components/report/report-table-skeleton";
import type { RoomPerformanceData } from "@/types/report";

interface RoomPerformanceCardProps {
  roomPerformance: RoomPerformanceData[];
  isLoading: boolean;
  totalBookings: number;
  totalNights: number;
  bookedRevenue: number;
}

export function RoomPerformanceCard({
  roomPerformance,
  isLoading,
  totalBookings,
  totalNights,
  bookedRevenue,
}: RoomPerformanceCardProps) {
  return (
    <Card className="bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-6">
        <CardTitle className="text-navy text-base sm:text-lg">Room Performance</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCSV(roomPerformance, "room-performance")}
          disabled={roomPerformance.length === 0}
          className="h-8 text-xs sm:text-sm"
        >
          <Download className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Export CSV</span>
        </Button>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {isLoading ? (
          <div className="px-4 sm:px-0">
            <ReportTableSkeleton />
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y">
              {roomPerformance.map((room) => (
                <div key={room.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-navy text-lg">
                      Room {room.roomNumber}
                    </span>
                    <span className="text-sm text-gray-500">
                      ${room.pricePerNight}/night
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg py-2">
                      <div className="text-sm font-semibold text-gray-900">
                        {room.totalBookings}
                      </div>
                      <div className="text-xs text-gray-500">Bookings</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-2">
                      <div className="text-sm font-semibold text-gray-900">
                        {room.totalNights}
                      </div>
                      <div className="text-xs text-gray-500">Nights</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg py-2">
                      <div className="text-sm font-semibold text-emerald-600">
                        ${room.bookedRevenue.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">Booked</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm font-medium text-gray-500">
                    <th className="text-left py-3 px-4">Room</th>
                    <th className="text-right py-3 px-4">Rate/Night</th>
                    <th className="text-right py-3 px-4">Total Bookings</th>
                    <th className="text-right py-3 px-4">Total Nights</th>
                    <th className="text-right py-3 px-4">Booked Revenue</th>
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
                        ${room.bookedRevenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-gray-50 font-semibold">
                    <td colSpan={2} className="py-3 px-4">
                      Total
                    </td>
                    <td className="py-3 px-4 text-right">{totalBookings}</td>
                    <td className="py-3 px-4 text-right">{totalNights}</td>
                    <td className="py-3 px-4 text-right text-emerald-600">
                      ${bookedRevenue.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
