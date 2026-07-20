import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { startOfDay, endOfDay } from "date-fns";
import type { DashboardStats, RecentBooking } from "@/types/report";

/**
 * Get dashboard statistics overview
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const [
    todayCheckIns,
    todayCheckOuts,
    currentOccupancy,
    pendingBookings,
    recentBookingsData,
    totalRooms,
  ] = await Promise.all([
    // Today's check-ins
    prisma.booking.count({
      where: {
        checkIn: { gte: todayStart, lte: todayEnd },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
      },
    }),
    // Today's check-outs
    prisma.booking.count({
      where: {
        checkOut: { gte: todayStart, lte: todayEnd },
        status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
      },
    }),
    // Currently occupied rooms
    prisma.booking.count({
      where: {
        status: BookingStatus.CHECKED_IN,
      },
    }),
    // Pending/confirmed bookings
    prisma.booking.count({
      where: {
        status: BookingStatus.CONFIRMED,
        checkIn: { gte: todayStart },
      },
    }),
    // Recent bookings
    prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bookingRef: true,
        guestName: true,
        guestPhone: true,
        checkIn: true,
        checkOut: true,
        status: true,
        createdAt: true,
        room: {
          select: { roomNumber: true },
        },
      },
    }),
    // Total rooms
    prisma.room.count(),
  ]);

  const occupancyRate =
    totalRooms > 0 ? Math.round((currentOccupancy / totalRooms) * 100) : 0;

  // Transform recent bookings to match the type
  const recentBookings: RecentBooking[] = recentBookingsData.map((booking) => ({
    id: booking.id,
    bookingRef: booking.bookingRef,
    guestName: booking.guestName,
    guestPhone: booking.guestPhone,
    checkIn: booking.checkIn.toISOString(),
    checkOut: booking.checkOut.toISOString(),
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    room: {
      roomNumber: booking.room.roomNumber,
    },
  }));

  return {
    todayCheckIns,
    todayCheckOuts,
    currentOccupancy,
    occupancyRate,
    pendingBookings,
    totalRooms,
    recentBookings,
  };
}
