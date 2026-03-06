"use client";

import * as React from "react";
import { format, startOfWeek, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
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

const suggestions = [
  {
    label: "Today",
    getValue: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
  {
    label: "This week",
    getValue: () => {
      const today = new Date();
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: today };
    },
  },
  {
    label: "Last 7 days",
    getValue: () => {
      const today = new Date();
      return { from: subDays(today, 7), to: today };
    },
  },
  {
    label: "This month",
    getValue: () => {
      const today = new Date();
      return { from: startOfMonth(today), to: today };
    },
  },
  {
    label: "Last 30 days",
    getValue: () => {
      const today = new Date();
      return { from: subDays(today, 30), to: today };
    },
  },
  {
    label: "This year",
    getValue: () => {
      const today = new Date();
      return { from: startOfYear(today), to: today };
    },
  },
];

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

  const handleSuggestionClick = (suggestion: typeof suggestions[0]) => {
    const range = suggestion.getValue();
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
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, "MMM d, yyyy")} - {format(value.to, "MMM d, yyyy")}
              </>
            ) : (
              format(value.from, "MMM d, yyyy")
            )
          ) : (
            <span>Select date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
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
              {suggestions.map((suggestion) => {
                const suggestionRange = suggestion.getValue();
                const isSelected =
                  tempRange?.from &&
                  tempRange?.to &&
                  format(tempRange.from, "yyyy-MM-dd") === format(suggestionRange.from, "yyyy-MM-dd") &&
                  format(tempRange.to, "yyyy-MM-dd") === format(suggestionRange.to, "yyyy-MM-dd");

                return (
                  <Button
                    key={suggestion.label}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start text-left h-auto py-2",
                      isSelected && "bg-navy text-cream hover:bg-navy-dark"
                    )}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div>
                      <div className="font-medium">{suggestion.label}</div>
                      <div className={cn("text-xs", isSelected ? "text-cream/70" : "text-muted-foreground")}>
                        {format(suggestionRange.from, "d MMM")} - {format(suggestionRange.to, "d MMM yy")}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-navy hover:bg-navy-dark text-cream"
            onClick={handleApply}
            disabled={!tempRange?.from || !tempRange?.to}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
