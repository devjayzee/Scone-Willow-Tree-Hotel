import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/rooms/available - Get available rooms for given dates
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");

    if (!checkIn || !checkOut) {
      return NextResponse.json(
        { error: "checkIn and checkOut dates are required" },
        { status: 400 }
      );
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Get all rooms
    const allRooms = await prisma.room.findMany({
      orderBy: { roomNumber: "asc" },
    });

    // Sort numerically
    allRooms.sort((a, b) => {
      const numA = parseInt(a.roomNumber) || 0;
      const numB = parseInt(b.roomNumber) || 0;
      return numA - numB;
    });

    // Find rooms with overlapping bookings
    const bookedRoomIds = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            // Booking starts before our checkout and ends after our checkin
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
        ],
      },
      select: { roomId: true },
    });

    const bookedIds = new Set(bookedRoomIds.map((b) => b.roomId));

    // Filter available rooms
    const availableRooms = allRooms.filter((room) => !bookedIds.has(room.id));

    return NextResponse.json(availableRooms);
  } catch (error) {
    console.error("Error fetching available rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch available rooms" },
      { status: 500 }
    );
  }
}
