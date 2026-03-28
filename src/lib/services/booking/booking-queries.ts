import prisma from "@/lib/prisma";
import type { BookingStatus } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { bookingSelectFields } from "./booking-constants";

export interface GetAllBookingsOptions {
  status?: BookingStatus;
  roomId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Get all bookings with optional filtering
 */
export async function getAllBookings(options?: GetAllBookingsOptions) {
  const { status, roomId, startDate, endDate } = options ?? {};

  const bookings = await prisma.booking.findMany({
    where: {
      ...(status && { status }),
      ...(roomId && { roomId }),
      ...(startDate && { checkIn: { gte: startDate } }),
      ...(endDate && { checkOut: { lte: endDate } }),
    },
    select: bookingSelectFields,
    orderBy: [{ checkIn: "desc" }, { bookingRef: "desc" }],
  });

  return bookings;
}

/**
 * Get a single booking by ID
 * @throws NotFoundError if booking not found
 */
export async function getBookingById(id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: bookingSelectFields,
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return booking;
}

/**
 * Get a single booking by booking reference
 * @throws NotFoundError if booking not found
 */
export async function getBookingByRef(bookingRef: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    select: bookingSelectFields,
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return booking;
}
