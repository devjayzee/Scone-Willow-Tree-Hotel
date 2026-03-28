import prisma from "@/lib/prisma";
import { NotFoundError, BusinessRuleError } from "@/lib/errors";
import {
  createAuditLog,
  AuditAction,
  EntityType,
} from "../audit-service";
import { bookingSelectFields } from "./booking-constants";
import { validateStatusTransition } from "./booking-utils";
import { startOfDay } from "date-fns";

/**
 * Check in a booking
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if booking cannot be checked in
 */
export async function checkInBooking(id: string, performedBy?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, bookingRef: true, guestName: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  validateStatusTransition(booking.status, "CHECKED_IN");

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: "CHECKED_IN" },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_CHECKED_IN,
      EntityType.BOOKING,
      id,
      {
        previous: { status: booking.status },
        current: { status: "CHECKED_IN" },
      }
    );
  }

  return updatedBooking;
}

/**
 * Check out a booking
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if booking cannot be checked out
 */
export async function checkOutBooking(id: string, performedBy?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, bookingRef: true, guestName: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  validateStatusTransition(booking.status, "CHECKED_OUT");

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: "CHECKED_OUT" },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_CHECKED_OUT,
      EntityType.BOOKING,
      id,
      {
        previous: { status: booking.status },
        current: { status: "CHECKED_OUT" },
      }
    );
  }

  return updatedBooking;
}

/**
 * Cancel a booking
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if booking cannot be cancelled
 */
export async function cancelBooking(
  id: string,
  reason?: string,
  performedBy?: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, bookingRef: true, guestName: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  validateStatusTransition(booking.status, "CANCELLED");

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_CANCELLED,
      EntityType.BOOKING,
      id,
      {
        previous: { status: booking.status },
        current: { status: "CANCELLED" },
        reason: reason || "Booking cancelled",
      }
    );
  }

  return updatedBooking;
}

/**
 * Toggle payment status for a booking
 * @throws NotFoundError if booking not found
 */
export async function togglePaymentStatus(id: string, performedBy?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, isPaid: true, bookingRef: true, guestName: true },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  const newIsPaid = !booking.isPaid;

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { isPaid: newIsPaid },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_UPDATED,
      EntityType.BOOKING,
      id,
      {
        previous: { isPaid: booking.isPaid },
        current: { isPaid: newIsPaid },
      }
    );
  }

  return updatedBooking;
}

/**
 * Undo checkout for a booking (change status from CHECKED_OUT back to CHECKED_IN)
 * Only allowed if the checkout date has not passed yet.
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if checkout date has passed or status transition is invalid
 */
export async function undoCheckOutBooking(id: string, performedBy?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      checkOut: true,
      bookingRef: true,
      guestName: true,
    },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  // Validate status transition
  validateStatusTransition(booking.status, "CHECKED_IN");

  // Check if checkout date has passed
  const today = startOfDay(new Date());
  const checkOutDate = startOfDay(new Date(booking.checkOut));

  if (today > checkOutDate) {
    throw new BusinessRuleError(
      "Cannot undo checkout after the checkout date has passed"
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: "CHECKED_IN" },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_UPDATED,
      EntityType.BOOKING,
      id,
      {
        previous: { status: booking.status },
        current: { status: "CHECKED_IN" },
        reason: "Undo accidental checkout",
      }
    );
  }

  return updatedBooking;
}

/**
 * Undo cancellation for a booking (change status from CANCELLED back to CONFIRMED)
 * Only allowed if the checkout date has not passed yet.
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if checkout date has passed or status transition is invalid
 */
export async function undoCancelBooking(id: string, performedBy?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      checkOut: true,
      bookingRef: true,
      guestName: true,
    },
  });

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  // Validate status transition
  validateStatusTransition(booking.status, "CONFIRMED");

  // Check if checkout date has passed
  const today = startOfDay(new Date());
  const checkOutDate = startOfDay(new Date(booking.checkOut));

  if (today > checkOutDate) {
    throw new BusinessRuleError(
      "Cannot undo cancellation after the checkout date has passed"
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: "CONFIRMED" },
    select: bookingSelectFields,
  });

  // Audit log
  if (performedBy) {
    await createAuditLog(
      performedBy,
      AuditAction.BOOKING_UPDATED,
      EntityType.BOOKING,
      id,
      {
        previous: { status: booking.status },
        current: { status: "CONFIRMED" },
        reason: "Undo accidental cancellation",
      }
    );
  }

  return updatedBooking;
}
