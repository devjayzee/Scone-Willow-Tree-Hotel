import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  eachDayOfInterval,
  format,
  differenceInDays,
} from "date-fns";
import type {
  DashboardStats,
  OccupancyData,
  RevenueData,
  BookingTrendData,
  RoomPerformanceData,
  RecentBooking,
} from "@/types/report";

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
        guestEmail: true,
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
    guestEmail: booking.guestEmail,
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

/**
 * Get monthly occupancy data for the last 6 months
 */
export async function getOccupancyReport(): Promise<OccupancyData[]> {
  const today = new Date();
  const months: OccupancyData[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(today, i));
    const monthEnd = endOfMonth(subMonths(today, i));
    const daysInMonth = eachDayOfInterval({
      start: monthStart,
      end: monthEnd,
    }).length;

    const totalRooms = await prisma.room.count();
    const totalRoomDays = totalRooms * daysInMonth;

    // Count booked room-days
    const bookings = await prisma.booking.findMany({
      where: {
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.CHECKED_OUT,
          ],
        },
        OR: [
          { checkIn: { gte: monthStart, lte: monthEnd } },
          { checkOut: { gte: monthStart, lte: monthEnd } },
          {
            AND: [
              { checkIn: { lte: monthStart } },
              { checkOut: { gte: monthEnd } },
            ],
          },
        ],
      },
    });

    let bookedDays = 0;
    bookings.forEach((booking) => {
      const bookingStart =
        booking.checkIn > monthStart ? booking.checkIn : monthStart;
      const bookingEnd =
        booking.checkOut < monthEnd ? booking.checkOut : monthEnd;
      bookedDays += Math.max(0, differenceInDays(bookingEnd, bookingStart));
    });

    const occupancyRate =
      totalRoomDays > 0 ? Math.round((bookedDays / totalRoomDays) * 100) : 0;

    months.push({
      month: format(monthStart, "MMM yyyy"),
      occupancy: occupancyRate,
      bookedDays,
      totalDays: totalRoomDays,
    });
  }

  return months;
}

/**
 * Get monthly revenue data for the last 6 months
 */
export async function getRevenueReport(): Promise<RevenueData[]> {
  const today = new Date();
  const months: RevenueData[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(today, i));
    const monthEnd = endOfMonth(subMonths(today, i));

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
        checkIn: { gte: monthStart, lte: monthEnd },
      },
      include: {
        room: {
          select: { pricePerNight: true },
        },
      },
    });

    let revenue = 0;
    bookings.forEach((booking) => {
      const nights = differenceInDays(booking.checkOut, booking.checkIn);
      const pricePerNight = Number(booking.room.pricePerNight);
      revenue += nights * pricePerNight;
    });

    months.push({
      month: format(monthStart, "MMM yyyy"),
      revenue: Math.round(revenue),
    });
  }

  return months;
}

/**
 * Get daily booking trends for the last 30 days
 */
export async function getBookingTrends(): Promise<BookingTrendData[]> {
  const today = new Date();
  const days: BookingTrendData[] = [];

  for (let i = 29; i >= 0; i--) {
    const day = subDays(today, i);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);

    const count = await prisma.booking.count({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
      },
    });

    days.push({
      date: format(dayStart, "MMM dd"),
      bookings: count,
    });
  }

  return days;
}

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
      },
    },
    orderBy: { roomNumber: "asc" },
  });

  const roomStats: RoomPerformanceData[] = rooms.map((room) => {
    const totalBookings = room.bookings.length;
    let totalNights = 0;
    let totalRevenue = 0;

    room.bookings.forEach((booking) => {
      const nights = differenceInDays(booking.checkOut, booking.checkIn);
      totalNights += nights;
      totalRevenue += nights * Number(room.pricePerNight);
    });

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      pricePerNight: Number(room.pricePerNight),
      totalBookings,
      totalNights,
      totalRevenue: Math.round(totalRevenue),
    };
  });

  return roomStats;
}
