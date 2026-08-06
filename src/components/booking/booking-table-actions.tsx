"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileDown,
  DollarSign,
  LogIn,
  LogOut,
  XCircle,
  Undo2,
} from "lucide-react";
import { startOfDay } from "date-fns";
import { downloadBookingPDF } from "@/lib/utils/pdf/booking-registration";
import type { Booking, BookingSummary } from "@/types/booking";

export interface BookingTableActionsProps<T extends BookingSummary> {
  booking: T;
  onView: (booking: T) => void;
  onEdit: (booking: T) => void;
  onDelete: (booking: T) => void;
  onTogglePayment: (booking: T) => void;
  onCheckIn: (booking: T) => void;
  onCheckOut: (booking: T) => void;
  onUndoCheckOut: (booking: T) => void;
  onCancel: (booking: T) => void;
  onUndoCancel: (booking: T) => void;
}

/**
 * Check if checkout can be undone (checkout date hasn't passed)
 */
export function canUndoCheckOut<T extends BookingSummary>(booking: T): boolean {
  if (booking.status !== "CHECKED_OUT") return false;
  const today = startOfDay(new Date());
  const checkOutDate = startOfDay(new Date(booking.checkOut));
  return today <= checkOutDate;
}

/**
 * Check if cancellation can be undone (checkout date hasn't passed)
 */
export function canUndoCancel<T extends BookingSummary>(booking: T): boolean {
  if (booking.status !== "CANCELLED") return false;
  const today = startOfDay(new Date());
  const checkOutDate = startOfDay(new Date(booking.checkOut));
  return today <= checkOutDate;
}

/**
 * Dropdown action menu for booking table rows
 */
export function BookingTableActions<T extends BookingSummary>({
  booking,
  onView,
  onEdit,
  onDelete,
  onTogglePayment,
  onCheckIn,
  onCheckOut,
  onUndoCheckOut,
  onCancel,
  onUndoCancel,
}: BookingTableActionsProps<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-gray-600"
          aria-label={`Actions for booking ${booking.bookingRef}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onView(booking)}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        {(booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && (
          <DropdownMenuItem onClick={() => onEdit(booking)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Booking
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          // The BookingTable generic constraint is `T extends BookingSummary`
          // but the only caller today (bookings-client) instantiates T as the
          // richer `Booking`. Cast is safe at runtime; tighten the constraint
          // to `Booking` if a summary-only caller ever appears.
          onClick={() => downloadBookingPDF(booking as unknown as Booking)}
        >
          <FileDown className="mr-2 h-4 w-4" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onTogglePayment(booking)}>
          <DollarSign className="mr-2 h-4 w-4" />
          {booking.isPaid ? "Mark as Unpaid" : "Mark as Paid"}
        </DropdownMenuItem>
        {booking.status === "CONFIRMED" && (
          <DropdownMenuItem
            onClick={() => onCheckIn(booking)}
            className="text-green-600 focus:text-green-600"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Check In
          </DropdownMenuItem>
        )}
        {booking.status === "CHECKED_IN" && (
          <DropdownMenuItem
            onClick={() => onCheckOut(booking)}
            className="text-blue-600 focus:text-blue-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Check Out
          </DropdownMenuItem>
        )}
        {canUndoCheckOut(booking) && (
          <DropdownMenuItem
            onClick={() => onUndoCheckOut(booking)}
            className="text-orange-600 focus:text-orange-600"
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Undo Checkout
          </DropdownMenuItem>
        )}
        {canUndoCancel(booking) && (
          <DropdownMenuItem
            onClick={() => onUndoCancel(booking)}
            className="text-green-600 focus:text-green-600"
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Undo Cancel
          </DropdownMenuItem>
        )}
        {(booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && (
          <DropdownMenuItem
            onClick={() => onCancel(booking)}
            className="text-orange-600 focus:text-orange-600"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Booking
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(booking)}
          disabled={booking.status !== "CANCELLED"}
          className={
            booking.status === "CANCELLED"
              ? "text-red-600 focus:text-red-600"
              : "text-gray-400 cursor-not-allowed"
          }
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
