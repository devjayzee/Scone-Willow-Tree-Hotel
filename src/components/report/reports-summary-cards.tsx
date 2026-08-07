"use client";

import { Calendar, TrendingUp, DollarSign } from "lucide-react";

interface ReportsSummaryCardsProps {
  totalBookings: number;
  totalNights: number;
  totalRevenue: number;
}

export function ReportsSummaryCards({
  totalBookings,
  totalNights,
  totalRevenue,
}: ReportsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3 md:hidden">
      <div className="bg-white rounded-lg border p-3 text-center">
        <div className="flex justify-center mb-1">
          <Calendar className="h-4 w-4 text-blue-500" />
        </div>
        <div className="text-lg font-bold text-navy">{totalBookings}</div>
        <div className="text-xs text-gray-500">Bookings</div>
      </div>
      <div className="bg-white rounded-lg border p-3 text-center">
        <div className="flex justify-center mb-1">
          <TrendingUp className="h-4 w-4 text-purple-500" />
        </div>
        <div className="text-lg font-bold text-navy">{totalNights}</div>
        <div className="text-xs text-gray-500">Nights</div>
      </div>
      <div className="bg-white rounded-lg border p-3 text-center">
        <div className="flex justify-center mb-1">
          <DollarSign className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="text-lg font-bold text-emerald-600">
          ${totalRevenue.toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">Revenue</div>
      </div>
    </div>
  );
}
