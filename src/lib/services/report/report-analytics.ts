import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { startOfDay, endOfDay, differenceInDays } from "date-fns";
import type { RoomPerformanceData } from "@/types/report";

/**
 * Get room performance data with optional date filtering
 */
export async function getRoomPerformance(
  startDate?: Date,
  endDate?: Date
): Promise<RoomPerformanceData[]> {
  // Build booking filter
  const bookingFilter: {
    status: { in: BookingStatus[] };
    checkIn?: { gte: Date; lte: Date };
  } = {
    status: {
      in: [
        BookingStatus.CONFIRMED,
        BookingStatus.CHECKED_IN,
        BookingStatus.CHECKED_OUT,
      ],
    },
  };

  if (startDate && endDate) {
    bookingFilter.checkIn = {
      gte: startOfDay(startDate),
      lte: endOfDay(endDate),
    };
  }

  const rooms = await prisma.room.findMany({
    include: {
      bookings: {
        where: bookingFilter,
        select: {
          checkIn: true,
          checkOut: true,
          ratePerNight: true,
        },
      },
    },
    orderBy: { roomNumber: "asc" },
  });

  const roomStats: RoomPerformanceData[] = rooms.map((room) => {
    const totalBookings = room.bookings.length;
    let totalNights = 0;
    let totalRevenue = 0;

    // Revenue uses each booking's own ratePerNight snapshot.
    // room.pricePerNight below is the room's *current* rate — kept as
    // a display anchor on the row, not used in the sum.
    room.bookings.forEach((booking) => {
      const nights = differenceInDays(booking.checkOut, booking.checkIn);
      totalNights += nights;
      totalRevenue += nights * Number(booking.ratePerNight);
    });

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      pricePerNight: Number(room.pricePerNight),
      totalBookings,
      totalNights,
      bookedRevenue: Math.round(totalRevenue),
    };
  });

  return roomStats;
}
