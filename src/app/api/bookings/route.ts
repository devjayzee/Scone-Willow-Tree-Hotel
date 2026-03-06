import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createBookingSchema } from "@/lib/validations/booking";
import { getAllBookings, createBooking } from "@/lib/services/booking-service";
import { handleApiError, UnauthorizedError } from "@/lib/api-error-handler";
import type { BookingStatus } from "@prisma/client";

// GET /api/bookings - Get all bookings
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as BookingStatus | null;
    const roomId = searchParams.get("roomId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const bookings = await getAllBookings({
      ...(status && { status }),
      ...(roomId && { roomId }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
    });

    return NextResponse.json(bookings);
  } catch (error) {
    return handleApiError(error, "fetching bookings");
  }
}

// POST /api/bookings - Create a new booking
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const validation = createBookingSchema.safeParse(body);

    if (!validation.success) {
      return handleApiError(validation.error, "creating booking");
    }

    const booking = await createBooking(
      validation.data,
      session.user.id,
      session.user.id
    );

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    return handleApiError(error, "creating booking");
  }
}
