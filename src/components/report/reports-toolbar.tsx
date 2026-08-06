"use client";

import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { RefreshCw } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface ReportsToolbarProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onRefresh: () => void;
  isFetching: boolean;
}

export function ReportsToolbar({
  dateRange,
  onDateRangeChange,
  onRefresh,
  isFetching,
}: ReportsToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 max-w-sm">
        <DateRangePicker
          value={dateRange}
          onChange={onDateRangeChange}
          className="w-full"
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isFetching}
        title="Refresh reports"
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
