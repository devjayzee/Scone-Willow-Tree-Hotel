import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createRoomSchema } from "@/lib/validations/room";
import { getAllRooms, createRoom } from "@/lib/services/room-service";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/api-error-handler";

// GET /api/rooms - Get all rooms (GENERAL_MANAGER only — the /rooms
// page is GM-only; booking/calendar pages fetch rooms server-side via
// the service. MANAGER/STAFF flows that need room data at runtime use
// GET /api/rooms/available (kept open to any authenticated user).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      throw new ForbiddenError("Only general managers can view rooms");
    }

    const rooms = await getAllRooms();
    return NextResponse.json(rooms);
  } catch (error) {
    return handleApiError(error, "fetching rooms");
  }
}

// POST /api/rooms - Create a new room
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      throw new ForbiddenError("Only general managers can create rooms");
    }

    const body = await request.json();
    const validation = createRoomSchema.safeParse(body);

    if (!validation.success) {
      return handleApiError(validation.error, "creating room");
    }

    const room = await createRoom(validation.data, session.user.id);
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    return handleApiError(error, "creating room");
  }
}
