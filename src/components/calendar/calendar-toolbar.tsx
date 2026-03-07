"use client";

import { memo } from "react";
import { format, addMonths, addWeeks } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, CalendarRange } from "lucide-react";

type ViewType = "month" | "week";

interface CalendarToolbarProps {
  date: Date;
  view: ViewType;
  onNavigate: (date: Date) => void;
  onViewChange: (view: ViewType) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const CalendarToolbar = memo(function CalendarToolbar({
  date,
  view,
  onNavigate,
  onViewChange,
  onRefresh,
  isRefreshing,
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
    <>
      {/* Mobile Layout */}
      <div className="md:hidden bg-white rounded-lg border overflow-hidden">
        {/* Date Navigation - Full Width Header */}
        <div className="flex items-center justify-between px-2 py-3 bg-navy">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-cream hover:bg-white/10 hover:text-cream"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <button
            onClick={() => onNavigate(new Date())}
            className="text-center"
          >
            <div className="text-lg font-bold text-cream">
              {view === "month" ? format(date, "MMMM") : `Week of ${format(date, "MMM d")}`}
            </div>
            <div className="text-sm text-cream/70">
              {format(date, "yyyy")}
            </div>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-cream hover:bg-white/10 hover:text-cream"
            onClick={handleNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between p-2 bg-gray-50">
          {/* View Toggle */}
          <div className="inline-flex rounded-lg bg-gray-200 p-1">
            <button
              onClick={() => onViewChange("month")}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${view === "month"
                  ? "bg-white text-navy shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
                }
              `}
            >
              <CalendarDays className="h-4 w-4" />
              Month
            </button>
            <button
              onClick={() => onViewChange("week")}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${view === "week"
                  ? "bg-white text-navy shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
                }
              `}
            >
              <CalendarRange className="h-4 w-4" />
              Week
            </button>
          </div>

          {/* Today + Refresh */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-sm"
              onClick={() => onNavigate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex md:items-center justify-between gap-4 p-4 bg-white rounded-lg border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => onNavigate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-navy ml-2">
            {getDateLabel()}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh calendar"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
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
      </div>
    </>
  );
});
