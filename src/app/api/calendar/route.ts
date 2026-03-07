import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { handleApiError, UnauthorizedError } from "@/lib/api-error-handler";
import { getCalendarEvents } from "@/lib/services/calendar-service";

// GET /api/calendar - Get bookings for calendar view
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start") ?? undefined;
    const endDate = searchParams.get("end") ?? undefined;
    const roomId = searchParams.get("roomId") ?? undefined;

    const events = await getCalendarEvents(startDate, endDate, roomId);

    return NextResponse.json(events);
  } catch (error) {
    return handleApiError(error, "fetching calendar events");
  }
}
