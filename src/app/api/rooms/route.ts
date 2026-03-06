import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createRoomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  roomType: z.enum(["SINGLE", "STANDARD_DOUBLE", "LARGE_DOUBLE", "EXTRA_LARGE_DOUBLE", "KING_SINGLE", "LARGE_DOUBLE_PLUS"]).optional(),
  capacity: z.number().min(1).max(10).default(1),
  pricePerNight: z.number().min(0),
  description: z.string().optional(),
});

// GET /api/rooms - Get all rooms
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rooms = await prisma.room.findMany();

    // Sort numerically by room number
    rooms.sort((a, b) => {
      const numA = parseInt(a.roomNumber) || 0;
      const numB = parseInt(b.roomNumber) || 0;
      return numA - numB;
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

// POST /api/rooms - Create a new room
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only managers can create rooms
    if (session.user.role !== "GENERAL_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createRoomSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { roomNumber, roomType, capacity, pricePerNight, description } = validation.data;

    // Check if room number already exists
    const existingRoom = await prisma.room.findUnique({
      where: { roomNumber },
    });

    if (existingRoom) {
      return NextResponse.json(
        { error: "Room number already exists" },
        { status: 400 }
      );
    }

    const room = await prisma.room.create({
      data: {
        roomNumber,
        roomType,
        capacity,
        pricePerNight,
        description,
      },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
