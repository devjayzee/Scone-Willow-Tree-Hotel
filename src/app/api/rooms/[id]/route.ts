import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateRoomSchema } from "@/lib/validations/room";
import { getRoomById, updateRoom, deleteRoom } from "@/lib/services/room-service";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/api-error-handler";

// GET /api/rooms/[id] - Get a single room
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { id } = await params;
    const room = await getRoomById(id);
    return NextResponse.json(room);
  } catch (error) {
    return handleApiError(error, "fetching room");
  }
}

// PUT /api/rooms/[id] - Update a room
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      throw new ForbiddenError("Only managers can update rooms");
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateRoomSchema.safeParse(body);

    if (!validation.success) {
      return handleApiError(validation.error, "updating room");
    }

    const room = await updateRoom(id, validation.data);
    return NextResponse.json(room);
  } catch (error) {
    return handleApiError(error, "updating room");
  }
}

// DELETE /api/rooms/[id] - Delete a room
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      throw new ForbiddenError("Only managers can delete rooms");
    }

    const { id } = await params;
    await deleteRoom(id);
    return NextResponse.json({ message: "Room deleted successfully" });
  } catch (error) {
    return handleApiError(error, "deleting room");
  }
}
