"use client";

import * as React from "react";
import { format, startOfWeek, startOfMonth, startOfYear, subDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

type SuggestionKey = "today" | "this_week" | "last_7_days" | "this_month" | "last_30_days" | "this_year";

const suggestionLabels: { key: SuggestionKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "last_7_days", label: "Last 7 days" },
  { key: "this_month", label: "This month" },
  { key: "last_30_days", label: "Last 30 days" },
  { key: "this_year", label: "This year" },
];

function getSuggestionValue(key: SuggestionKey): DateRange {
  const today = new Date();
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "this_week":
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: today };
    case "last_7_days":
      return { from: subDays(today, 7), to: today };
    case "this_month":
      return { from: startOfMonth(today), to: today };
    case "last_30_days":
      return { from: subDays(today, 30), to: today };
    case "this_year":
      return { from: startOfYear(today), to: today };
  }
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(value);

  React.useEffect(() => {
    if (open) {
      setTempRange(value);
    }
  }, [open, value]);

  const handleApply = () => {
    onChange(tempRange);
    setOpen(false);
  };

  const handleCancel = () => {
    setTempRange(value);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setTempRange(undefined);
    setOpen(false);
  };

  const handleSuggestionClick = (key: SuggestionKey) => {
    const range = getSuggestionValue(key);
    setTempRange(range);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal bg-white",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          {value?.from ? (
            value.to ? (
              <span className="truncate">
                {format(value.from, "MMM d, yyyy")} - {format(value.to, "MMM d, yyyy")}
              </span>
            ) : (
              format(value.from, "MMM d, yyyy")
            )
          ) : (
            <span>Select date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-32px)] sm:w-auto p-0 max-w-[380px] md:max-w-none"
        align="start"
        sideOffset={4}
      >
        {/* Mobile Layout */}
        <div className="md:hidden">
          {/* Quick Suggestions */}
          <div className="p-3 border-b">
            <div className="grid grid-cols-4 gap-2">
              {suggestionLabels.slice(0, 4).map((suggestion) => (
                <Button
                  key={suggestion.key}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-2"
                  onClick={() => handleSuggestionClick(suggestion.key)}
                >
                  {suggestion.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Selected Range Display */}
          <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
            <div className="text-sm">
              <span className="text-gray-500">From: </span>
              <span className="font-medium">
                {tempRange?.from ? format(tempRange.from, "MMM d, yyyy") : "—"}
              </span>
              <span className="text-gray-500 mx-2">→</span>
              <span className="text-gray-500">To: </span>
              <span className="font-medium">
                {tempRange?.to ? format(tempRange.to, "MMM d, yyyy") : "—"}
              </span>
            </div>
          </div>

          {/* Calendar */}
          <div className="p-3 overflow-x-auto">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={tempRange?.from}
              selected={tempRange}
              onSelect={setTempRange}
              numberOfMonths={1}
              className="[--cell-size:44px] mx-auto"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 border-t bg-gray-50">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              {value && (
                <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-600">
                  Clear
                </Button>
              )}
            </div>
            <Button
              size="sm"
              className="bg-navy hover:bg-navy-dark text-cream"
              onClick={handleApply}
              disabled={!tempRange?.from || !tempRange?.to}
            >
              Apply
            </Button>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block">
          <div className="flex">
            {/* Calendar Section */}
            <div className="p-4 border-r">
              <div className="flex gap-4 mb-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">From</label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-[140px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {tempRange?.from ? format(tempRange.from, "MMM d, yyyy") : "Start date"}
                  </Button>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">To</label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-[140px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {tempRange?.to ? format(tempRange.to, "MMM d, yyyy") : "End date"}
                  </Button>
                </div>
              </div>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={tempRange?.from}
                selected={tempRange}
                onSelect={setTempRange}
                numberOfMonths={1}
              />
            </div>

            {/* Suggestions Section */}
            <div className="p-4 w-[180px]">
              <h4 className="text-sm font-medium text-navy mb-3">Suggestions</h4>
              <div className="space-y-1">
                {suggestionLabels.map((suggestion) => (
                  <Button
                    key={suggestion.key}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => handleSuggestionClick(suggestion.key)}
                  >
                    <div className="font-medium">{suggestion.label}</div>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              {value && (
                <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-600">
                  Clear
                </Button>
              )}
            </div>
            <Button
              size="sm"
              className="bg-navy hover:bg-navy-dark text-cream"
              onClick={handleApply}
              disabled={!tempRange?.from || !tempRange?.to}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
