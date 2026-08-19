import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAvailableRooms } from "@/lib/services/room-service";
import { availableRoomsQuerySchema } from "@/lib/validations/room";
import { handleApiError, UnauthorizedError } from "@/lib/api-error-handler";

// GET /api/rooms/available - Get available rooms for given dates.
// Deliberately open to any authenticated user: the booking form (used by
// MANAGER and STAFF) queries this endpoint to populate the room-picker
// for a check-in/check-out window. Room CRUD lives at GET/POST/PUT/DELETE
// /api/rooms and is GENERAL_MANAGER-only.
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const parsed = availableRoomsQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    );
    if (!parsed.success) {
      return handleApiError(parsed.error, "fetching available rooms");
    }

    const availableRooms = await getAvailableRooms(
      new Date(parsed.data.checkIn),
      new Date(parsed.data.checkOut),
    );
    return NextResponse.json(availableRooms);
  } catch (error) {
    return handleApiError(error, "fetching available rooms");
  }
}
