import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  eachDayOfInterval,
  format,
  differenceInDays,
} from "date-fns";

// GET /api/reports - Get reports data
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "dashboard";

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    if (type === "dashboard") {
      // Dashboard stats
      const [
        todayCheckIns,
        todayCheckOuts,
        currentOccupancy,
        pendingBookings,
        recentBookings,
        totalRooms,
      ] = await Promise.all([
        // Today's check-ins
        prisma.booking.count({
          where: {
            checkIn: { gte: todayStart, lte: todayEnd },
            status: { in: ["CONFIRMED", "CHECKED_IN"] },
          },
        }),
        // Today's check-outs
        prisma.booking.count({
          where: {
            checkOut: { gte: todayStart, lte: todayEnd },
            status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
          },
        }),
        // Currently occupied rooms
        prisma.booking.count({
          where: {
            status: "CHECKED_IN",
          },
        }),
        // Pending/confirmed bookings
        prisma.booking.count({
          where: {
            status: "CONFIRMED",
            checkIn: { gte: todayStart },
          },
        }),
        // Recent bookings
        prisma.booking.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            room: {
              select: { roomNumber: true, roomType: true },
            },
          },
        }),
        // Total rooms
        prisma.room.count(),
      ]);

      const occupancyRate = totalRooms > 0
        ? Math.round((currentOccupancy / totalRooms) * 100)
        : 0;

      return NextResponse.json({
        todayCheckIns,
        todayCheckOuts,
        currentOccupancy,
        occupancyRate,
        pendingBookings,
        totalRooms,
        recentBookings,
      });
    }

    if (type === "occupancy") {
      // Monthly occupancy data for the last 6 months
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(today, i));
        const monthEnd = endOfMonth(subMonths(today, i));
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;

        const totalRooms = await prisma.room.count();
        const totalRoomDays = totalRooms * daysInMonth;

        // Count booked room-days
        const bookings = await prisma.booking.findMany({
          where: {
            status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
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
          const bookingStart = booking.checkIn > monthStart ? booking.checkIn : monthStart;
          const bookingEnd = booking.checkOut < monthEnd ? booking.checkOut : monthEnd;
          bookedDays += Math.max(0, differenceInDays(bookingEnd, bookingStart));
        });

        const occupancyRate = totalRoomDays > 0
          ? Math.round((bookedDays / totalRoomDays) * 100)
          : 0;

        months.push({
          month: format(monthStart, "MMM yyyy"),
          occupancy: occupancyRate,
          bookedDays,
          totalDays: totalRoomDays,
        });
      }

      return NextResponse.json(months);
    }

    if (type === "revenue") {
      // Monthly revenue for the last 6 months
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(today, i));
        const monthEnd = endOfMonth(subMonths(today, i));

        const bookings = await prisma.booking.findMany({
          where: {
            status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
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

      return NextResponse.json(months);
    }

    if (type === "bookings") {
      // Booking trends - last 30 days
      const days = [];
      for (let i = 29; i >= 0; i--) {
        const day = subMonths(today, 0);
        day.setDate(today.getDate() - i);
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

      return NextResponse.json(days);
    }

    if (type === "rooms") {
      // Room performance with optional date filter
      const startDateParam = searchParams.get("startDate");
      const endDateParam = searchParams.get("endDate");

      // Build booking filter
      const bookingFilter: {
        status: { in: BookingStatus[] };
        checkIn?: { gte: Date; lte: Date };
      } = {
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
      };

      if (startDateParam && endDateParam) {
        const filterStartDate = startOfDay(new Date(startDateParam));
        const filterEndDate = endOfDay(new Date(endDateParam));
        bookingFilter.checkIn = {
          gte: filterStartDate,
          lte: filterEndDate,
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

      const roomStats = rooms.map((room) => {
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
          roomType: room.roomType,
          pricePerNight: Number(room.pricePerNight),
          totalBookings,
          totalNights,
          totalRevenue: Math.round(totalRevenue),
        };
      });

      return NextResponse.json(roomStats);
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
