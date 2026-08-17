import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error-handler";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getRoomPerformance } from "@/lib/services/report";
import { reportsQuerySchema } from "@/lib/validations/report";

// GET /api/reports?type=rooms — room-performance table for the reports
// page. The dashboard / occupancy / revenue / bookings type variants
// and their hooks were removed as unconsumed.
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

    const { startDate, endDate } = parsed.data;
    const data = await getRoomPerformance(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "fetching reports");
  }
}

