import { Badge } from "@/components/ui/badge";

type BookingStatus = "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  CONFIRMED: { label: "Confirmed", className: "bg-blue-50 text-blue-700" },
  CHECKED_IN: { label: "Checked In", className: "bg-emerald-50 text-emerald-700" },
  CHECKED_OUT: { label: "Checked Out", className: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700" },
};

interface BookingStatusBadgeProps {
  status: BookingStatus;
}

export function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
