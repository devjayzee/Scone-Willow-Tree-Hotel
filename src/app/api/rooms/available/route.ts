import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAvailableRooms } from "@/lib/services/room-service";
import {
  handleApiError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/api-error-handler";

// GET /api/rooms/available - Get available rooms for given dates
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");

    if (!checkIn || !checkOut) {
      throw new ValidationError("checkIn and checkOut dates are required");
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const availableRooms = await getAvailableRooms(checkInDate, checkOutDate);
    return NextResponse.json(availableRooms);
  } catch (error) {
    return handleApiError(error, "fetching available rooms");
  }
}
