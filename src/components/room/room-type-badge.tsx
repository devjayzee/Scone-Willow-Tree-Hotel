import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RoomType = "SINGLE" | "STANDARD_DOUBLE" | "LARGE_DOUBLE" | "EXTRA_LARGE_DOUBLE" | "KING_SINGLE" | "LARGE_DOUBLE_PLUS" | null;

const roomTypeStyles: Record<string, string> = {
  SINGLE: "bg-blue-100 text-blue-800",
  STANDARD_DOUBLE: "bg-green-100 text-green-800",
  LARGE_DOUBLE: "bg-purple-100 text-purple-800",
  EXTRA_LARGE_DOUBLE: "bg-amber-100 text-amber-800",
  KING_SINGLE: "bg-teal-100 text-teal-800",
  LARGE_DOUBLE_PLUS: "bg-rose-100 text-rose-800",
};

const roomTypeLabels: Record<string, string> = {
  SINGLE: "Single",
  STANDARD_DOUBLE: "Standard Double",
  LARGE_DOUBLE: "Large Double",
  EXTRA_LARGE_DOUBLE: "Extra Large Double",
  KING_SINGLE: "King Single",
  LARGE_DOUBLE_PLUS: "Large Double Plus",
};

export function RoomTypeBadge({ type }: { type: RoomType }) {
  if (!type) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not set
      </Badge>
    );
  }

  return (
    <Badge className={cn("font-medium", roomTypeStyles[type])}>
      {roomTypeLabels[type]}
    </Badge>
  );
}
