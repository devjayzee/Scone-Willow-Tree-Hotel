import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { format } from "date-fns";

const createBookingSchema = z.object({
  roomId: z.string().min(1, "Room is required"),
  // Guest Details
  guestName: z.string().min(1, "Guest name is required"),
  guestDateOfBirth: z.string().optional(),
  guestAddress: z.string().optional(),
  guestPhone: z.string().optional(),
  guestEmail: z.string().email("Valid email is required"),
  vehicleRego: z.string().optional(),
  additionalGuests: z.string().optional(),
  // Stay Details
  checkIn: z.string().min(1, "Check-in date is required"),
  checkInTime: z.string().optional(),
  checkOut: z.string().min(1, "Check-out date is required"),
  checkOutTime: z.string().optional(),
  bondDeposit: z.number().optional(),
  notes: z.string().optional(),
});

// Generate booking reference: BK-YYYYMMDD-XXX
async function generateBookingRef(): Promise<string> {
  const today = format(new Date(), "yyyyMMdd");
  const prefix = `BK-${today}-`;

  // Find the last booking reference for today
  const lastBooking = await prisma.booking.findFirst({
    where: {
      bookingRef: {
        startsWith: prefix,
      },
    },
    orderBy: {
      bookingRef: "desc",
    },
  });

  let nextNumber = 1;
  if (lastBooking) {
    const lastNumber = parseInt(lastBooking.bookingRef.split("-").pop() || "0");
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, "0")}`;
}

// GET /api/bookings - Get all bookings
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const bookings = await prisma.booking.findMany({
      where: status ? { status: status as "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" } : undefined,
      orderBy: [
        { checkIn: "desc" },
        { bookingRef: "desc" },
      ],
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            pricePerNight: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

// POST /api/bookings - Create a new booking
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createBookingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      roomId,
      guestName,
      guestDateOfBirth,
      guestAddress,
      guestPhone,
      guestEmail,
      vehicleRego,
      additionalGuests,
      checkIn,
      checkInTime,
      checkOut,
      checkOutTime,
      bondDeposit,
      notes,
    } = validation.data;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    if (checkOutDate <= checkInDate) {
      return NextResponse.json(
        { error: "Check-out date must be after check-in date" },
        { status: 400 }
      );
    }

    // Check for overlapping bookings
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            AND: [
              { checkIn: { lte: checkInDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
          {
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gte: checkOutDate } },
            ],
          },
          {
            AND: [
              { checkIn: { gte: checkInDate } },
              { checkOut: { lte: checkOutDate } },
            ],
          },
        ],
      },
    });

    if (overlappingBooking) {
      return NextResponse.json(
        { error: "Room is not available for the selected dates" },
        { status: 400 }
      );
    }

    const bookingRef = await generateBookingRef();

    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        roomId,
        guestName,
        guestDateOfBirth: guestDateOfBirth ? new Date(guestDateOfBirth) : null,
        guestAddress,
        guestPhone,
        guestEmail,
        vehicleRego,
        additionalGuests,
        checkIn: checkInDate,
        checkInTime,
        checkOut: checkOutDate,
        checkOutTime,
        bondDeposit,
        notes,
        createdById: session.user.id,
      },
      include: {
        room: true,
      },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
