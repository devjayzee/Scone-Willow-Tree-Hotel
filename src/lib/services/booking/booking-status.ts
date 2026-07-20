import type { BookingStatus } from "@prisma/client";
import { startOfDay } from "date-fns";
import prisma from "@/lib/prisma";
import { NotFoundError, BusinessRuleError } from "@/lib/errors";
import {
  createAuditLog,
  AuditAction,
  EntityType,
  type AuditActionType,
} from "../audit-service";
import { bookingSelectFields } from "./booking-constants";
import { validateStatusTransition } from "./booking-utils";

type StatusTransitionBooking = {
  id: string;
  status: BookingStatus;
  checkOut: Date;
  bookingRef: string;
  guestName: string;
};

type TransitionOptions = {
  performedBy?: string;
  auditAction: AuditActionType;
  preUpdate?: (booking: StatusTransitionBooking) => void;
  auditMeta?: (booking: StatusTransitionBooking) => Record<string, unknown>;
};

async function transitionBookingStatus(
  id: string,
  targetStatus: BookingStatus,
  opts: TransitionOptions
) {
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

  validateStatusTransition(booking.status, targetStatus);

  opts.preUpdate?.(booking);

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: targetStatus },
    select: bookingSelectFields,
  });

  if (opts.performedBy) {
    await createAuditLog(
      opts.performedBy,
      opts.auditAction,
      EntityType.BOOKING,
      id,
      {
        previous: { status: booking.status },
        current: { status: targetStatus },
        ...(opts.auditMeta?.(booking) ?? {}),
      }
    );
  }

  return updatedBooking;
}

function assertCheckoutNotPassed(
  checkOut: Date,
  message: string
): void {
  const today = startOfDay(new Date());
  const checkOutDate = startOfDay(new Date(checkOut));
  if (today > checkOutDate) {
    throw new BusinessRuleError(message);
  }
}

/**
 * Check in a booking
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if booking cannot be checked in
 */
export async function checkInBooking(id: string, performedBy?: string) {
  return transitionBookingStatus(id, "CHECKED_IN", {
    performedBy,
    auditAction: AuditAction.BOOKING_CHECKED_IN,
  });
}

/**
 * Check out a booking
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if booking cannot be checked out
 */
export async function checkOutBooking(id: string, performedBy?: string) {
  return transitionBookingStatus(id, "CHECKED_OUT", {
    performedBy,
    auditAction: AuditAction.BOOKING_CHECKED_OUT,
  });
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
  return transitionBookingStatus(id, "CANCELLED", {
    performedBy,
    auditAction: AuditAction.BOOKING_CANCELLED,
    auditMeta: () => ({ reason: reason || "Booking cancelled" }),
  });
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
  return transitionBookingStatus(id, "CHECKED_IN", {
    performedBy,
    auditAction: AuditAction.BOOKING_UPDATED,
    preUpdate: (booking) =>
      assertCheckoutNotPassed(
        booking.checkOut,
        "Cannot undo checkout after the checkout date has passed"
      ),
    auditMeta: () => ({ reason: "Undo accidental checkout" }),
  });
}

/**
 * Undo cancellation for a booking (change status from CANCELLED back to CONFIRMED)
 * Only allowed if the checkout date has not passed yet.
 * @throws NotFoundError if booking not found
 * @throws BusinessRuleError if checkout date has passed or status transition is invalid
 */
export async function undoCancelBooking(id: string, performedBy?: string) {
  return transitionBookingStatus(id, "CONFIRMED", {
    performedBy,
    auditAction: AuditAction.BOOKING_UPDATED,
    preUpdate: (booking) =>
      assertCheckoutNotPassed(
        booking.checkOut,
        "Cannot undo cancellation after the checkout date has passed"
      ),
    auditMeta: () => ({ reason: "Undo accidental cancellation" }),
  });
}
