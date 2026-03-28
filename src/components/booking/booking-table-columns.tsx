import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

/**
 * Column definitions for the booking table
 */
export const BOOKING_COLUMNS = [
  { key: "bookingRef", label: "Booking Ref", width: "w-[140px]", align: "text-left" },
  { key: "guest", label: "Guest", width: "w-[180px]", align: "text-left" },
  { key: "room", label: "Room", width: "w-[80px]", align: "text-left" },
  { key: "checkIn", label: "Check In", width: "w-[120px]", align: "text-left" },
  { key: "checkOut", label: "Check Out", width: "w-[120px]", align: "text-left" },
  { key: "status", label: "Status", width: "w-[110px]", align: "text-center" },
  { key: "paid", label: "Paid", width: "w-[80px]", align: "text-center" },
  { key: "actions", label: "Actions", width: "w-[70px]", align: "text-right" },
] as const;

/**
 * Status badge styles mapping
 */
export const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  CONFIRMED: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    label: "Confirmed",
  },
  CHECKED_IN: {
    bg: "bg-green-100",
    text: "text-green-800",
    label: "Checked In",
  },
  CHECKED_OUT: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    label: "Checked Out",
  },
  CANCELLED: {
    bg: "bg-red-100",
    text: "text-red-800",
    label: "Cancelled",
  },
};

/**
 * Renders a status badge for a booking
 */
export function BookingStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.CONFIRMED;
  return (
    <Badge className={`${style.bg} ${style.text} hover:${style.bg} min-w-[85px] justify-center`}>
      {style.label}
    </Badge>
  );
}

/**
 * Renders a payment status badge
 */
export function PaymentStatusBadge({ isPaid, size = "default" }: { isPaid: boolean; size?: "default" | "small" }) {
  const sizeClass = size === "small" ? "text-xs" : "";
  return (
    <Badge
      variant={isPaid ? "default" : "outline"}
      className={
        isPaid
          ? `bg-green-100 text-green-800 hover:bg-green-100 ${sizeClass}`
          : `bg-gray-100 text-gray-600 hover:bg-gray-100 ${sizeClass}`
      }
    >
      {isPaid ? "Paid" : "Unpaid"}
    </Badge>
  );
}

/**
 * Formats a date string for display
 */
export function formatBookingDate(dateString: string): string {
  return format(new Date(dateString), "MMM dd, yyyy");
}
