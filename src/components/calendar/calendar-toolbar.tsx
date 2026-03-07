"use client";

import { memo } from "react";
import { format, addMonths, addWeeks } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ViewType = "month" | "week";

interface CalendarToolbarProps {
  date: Date;
  view: ViewType;
  onNavigate: (date: Date) => void;
  onViewChange: (view: ViewType) => void;
}

export const CalendarToolbar = memo(function CalendarToolbar({
  date,
  view,
  onNavigate,
  onViewChange,
}: CalendarToolbarProps) {
  const handlePrev = () => {
    if (view === "month") {
      onNavigate(addMonths(date, -1));
    } else {
      onNavigate(addWeeks(date, -1));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      onNavigate(addMonths(date, 1));
    } else {
      onNavigate(addWeeks(date, 1));
    }
  };

  const getDateLabel = () => {
    if (view === "month") {
      return format(date, "MMMM yyyy");
    }
    return `Week of ${format(date, "MMM d, yyyy")}`;
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 p-4 bg-white rounded-lg border">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => onNavigate(new Date())}>
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-navy ml-2">
          {getDateLabel()}
        </h2>
      </div>

      <div className="flex border rounded-md">
        <Button
          variant={view === "month" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewChange("month")}
          className="rounded-r-none"
        >
          Month
        </Button>
        <Button
          variant={view === "week" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewChange("week")}
          className="rounded-l-none"
        >
          Week
        </Button>
      </div>
    </div>
  );
});
