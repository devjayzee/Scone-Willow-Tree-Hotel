import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  bookingActionSchema,
  updateBookingSchema,
} from "@/lib/validations/booking";
import {
  getBookingById,
  updateBooking,
  deleteBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  togglePaymentStatus,
  undoCheckOutBooking,
  undoCancelBooking,
} from "@/lib/services/booking-service";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/api-error-handler";

// GET /api/bookings/[id] - Get a single booking
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { id } = await params;
    const booking = await getBookingById(id);

    return NextResponse.json(booking);
  } catch (error) {
    return handleApiError(error, "fetching booking");
  }
}

// PUT /api/bookings/[id] - Update a booking
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateBookingSchema.safeParse(body);

    if (!validation.success) {
      return handleApiError(validation.error, "updating booking");
    }

    const booking = await updateBooking(id, validation.data, session.user.id);

    return NextResponse.json(booking);
  } catch (error) {
    return handleApiError(error, "updating booking");
  }
}

// PATCH /api/bookings/[id] - Partial update or status change
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    const { id } = await params;
    const body = await request.json();

    // Action dispatch: body has an `action` key → validate as a status
    // transition; anything else falls through to a partial update.
    if (body && typeof body === "object" && "action" in body) {
      const actionParsed = bookingActionSchema.safeParse(body);
      if (!actionParsed.success) {
        return handleApiError(actionParsed.error, "updating booking");
      }
      const action = actionParsed.data;

      let booking;
      switch (action.action) {
        case "check-in":
          booking = await checkInBooking(id, session.user.id);
          break;
        case "check-out":
          booking = await checkOutBooking(id, session.user.id);
          break;
        case "undo-checkout":
          booking = await undoCheckOutBooking(id, session.user.id);
          break;
        case "undo-cancel":
          booking = await undoCancelBooking(id, session.user.id);
          break;
        case "cancel":
          booking = await cancelBooking(id, action.reason, session.user.id);
          break;
        case "toggle-payment":
          booking = await togglePaymentStatus(id, session.user.id);
          break;
      }
      return NextResponse.json(booking);
    }

    const validation = updateBookingSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "updating booking");
    }
    const booking = await updateBooking(id, validation.data, session.user.id);
    return NextResponse.json(booking);
  } catch (error) {
    return handleApiError(error, "updating booking");
  }
}

// DELETE /api/bookings/[id] - Delete a booking
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    // Only managers can delete bookings
    if (session.user.role !== "GENERAL_MANAGER") {
      throw new ForbiddenError("Only managers can delete bookings");
    }

    const { id } = await params;
    const result = await deleteBooking(id, session.user.id);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "deleting booking");
  }
}
