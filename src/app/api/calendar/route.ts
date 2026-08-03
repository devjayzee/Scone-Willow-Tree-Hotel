import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { handleApiError, UnauthorizedError } from "@/lib/api-error-handler";
import { getCalendarEvents } from "@/lib/services/calendar-service";
import { calendarQuerySchema } from "@/lib/validations/calendar";

// GET /api/calendar - Get bookings for calendar view
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const parsed = calendarQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );
    if (!parsed.success) {
      return handleApiError(parsed.error, "fetching calendar events");
    }

    const { start, end, roomId } = parsed.data;
    const events = await getCalendarEvents(
      start ? new Date(start) : undefined,
      end ? new Date(end) : undefined,
      roomId,
    );

    return NextResponse.json(events);
  } catch (error) {
    return handleApiError(error, "fetching calendar events");
  }
}
