import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error-handler";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import {
  getDashboardStats,
  getOccupancyReport,
  getRevenueReport,
  getBookingTrends,
  getRoomPerformance,
} from "@/lib/services/report";
import { reportsQuerySchema } from "@/lib/validations/report";

// GET /api/reports - Get reports data
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    if (
      session.user.role !== "GENERAL_MANAGER" &&
      session.user.role !== "MANAGER"
    ) {
      throw new ForbiddenError("Only managers can view reports");
    }

    const { searchParams } = new URL(request.url);
    const parsed = reportsQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );
    if (!parsed.success) {
      return handleApiError(parsed.error, "fetching reports");
    }

    // claude-allow: rule-1 — 5-case type router where each branch is a single
    // service-call delegation. Extracting to a service `getReport(type, ...)`
    // would relocate the same switch across a module boundary with no
    // consolidation (no shared surface, no per-case parameter shaping worth
    // centralizing, no CLI/background caller). See #65 sub-item 2.
    switch (parsed.data.type) {
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
        const { startDate, endDate } = parsed.data;
        const data = await getRoomPerformance(
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined,
        );
        return NextResponse.json(data);
      }
    }
  } catch (error) {
    return handleApiError(error, "fetching reports");
  }
}
