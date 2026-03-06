import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error-handler";
import { UnauthorizedError } from "@/lib/errors";
import {
  getDashboardStats,
  getOccupancyReport,
  getRevenueReport,
  getBookingTrends,
  getRoomPerformance,
} from "@/lib/services/report-service";
import type { ReportType } from "@/types/report";

// GET /api/reports - Get reports data
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "dashboard") as ReportType;

    switch (type) {
      case "dashboard": {
        const stats = await getDashboardStats();
        return NextResponse.json(stats);
      }

      case "occupancy": {
        const data = await getOccupancyReport();
        return NextResponse.json(data);
      }

      case "revenue": {
        const data = await getRevenueReport();
        return NextResponse.json(data);
      }

      case "bookings": {
        const data = await getBookingTrends();
        return NextResponse.json(data);
      }

      case "rooms": {
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");

        const startDate = startDateParam ? new Date(startDateParam) : undefined;
        const endDate = endDateParam ? new Date(endDateParam) : undefined;

        const data = await getRoomPerformance(startDate, endDate);
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 }
        );
    }
  } catch (error) {
    return handleApiError(error, "fetching reports");
  }
}
