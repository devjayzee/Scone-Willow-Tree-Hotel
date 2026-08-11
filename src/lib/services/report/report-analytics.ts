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
  OccupancyData,
  RevenueData,
  BookingTrendData,
  RoomPerformanceData,
} from "@/types/report";

/**
 * Get monthly occupancy data for the last 6 months
 */
export async function getOccupancyReport(): Promise<OccupancyData[]> {
  const today = new Date();
  const months: OccupancyData[] = [];

  // Room count is invariant across the 6 iterations (#188). Hoist it
  // out of the loop instead of re-issuing the same query six times.
  const totalRooms = await prisma.room.count();

  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(today, i));
    const monthEnd = endOfMonth(subMonths(today, i));
    const daysInMonth = eachDayOfInterval({
      start: monthStart,
      end: monthEnd,
    }).length;

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

    // Read booking.ratePerNight (snapshotted at creation, #185) rather
    // than the room's current price — otherwise a later re-price would
    // retroactively change historical revenue figures.
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
        checkIn: { gte: monthStart, lte: monthEnd },
      },
      select: {
        checkIn: true,
        checkOut: true,
        ratePerNight: true,
      },
    });

    let revenue = 0;
    bookings.forEach((booking) => {
      const nights = differenceInDays(booking.checkOut, booking.checkIn);
      revenue += nights * Number(booking.ratePerNight);
    });

    months.push({
      month: format(monthStart, "MMM yyyy"),
      realisedRevenue: Math.round(revenue),
    });
  }

  return months;
}

/**
 * Get daily booking trends for the last 30 days
 */
export async function getBookingTrends(): Promise<BookingTrendData[]> {
  const today = new Date();
  const rangeStart = startOfDay(subDays(today, 29));
  const rangeEnd = endOfDay(today);

  // Was 30 sequential prisma.booking.count() queries — one per day
  // (#188). Now a single findMany over the 30-day window, bucketed in
  // memory so days with zero bookings still appear in the returned
  // series. Portable across Prisma providers vs raw SQL DATE_TRUNC.
  const bookings = await prisma.booking.findMany({
    where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
    select: { createdAt: true },
  });

  const countsByDay = new Map<string, number>();
  for (const booking of bookings) {
    const key = format(startOfDay(booking.createdAt), "yyyy-MM-dd");
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const days: BookingTrendData[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = startOfDay(subDays(today, i));
    const key = format(day, "yyyy-MM-dd");
    days.push({
      date: format(day, "MMM dd"),
      bookings: countsByDay.get(key) ?? 0,
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

    // Revenue uses each booking's own ratePerNight snapshot (#185).
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
