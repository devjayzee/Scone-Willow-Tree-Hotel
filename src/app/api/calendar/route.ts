import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";

// GET /api/calendar - Get bookings for calendar view
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const roomId = searchParams.get("roomId");

    // Build where clause
    const where: {
      status: { in: BookingStatus[] };
      checkIn?: { gte: Date };
      checkOut?: { lte: Date };
      roomId?: string;
    } = {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
    };

    if (start) {
      where.checkIn = { gte: new Date(start) };
    }
    if (end) {
      where.checkOut = { lte: new Date(end) };
    }
    if (roomId && roomId !== "all") {
      where.roomId = roomId;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
          },
        },
      },
      orderBy: { checkIn: "asc" },
    });

    // Transform bookings to calendar events
    // For hotel bookings, checkout day means the room is available for new guests
    // Subtract 1 day from checkout to show only the occupied nights
    const events = bookings.map((booking) => {
      const displayEnd = new Date(booking.checkOut);
      displayEnd.setDate(displayEnd.getDate() - 1);

      return {
        id: booking.id,
        title: `Room ${booking.room.roomNumber} - ${booking.guestName}`,
        start: booking.checkIn,
        end: displayEnd,
        resource: {
          bookingRef: booking.bookingRef,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          roomNumber: booking.room.roomNumber,
          roomType: booking.room.roomType,
          status: booking.status,
        },
      };
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
