"use client";

import { useEffect, useRef, useState } from "react";
import { isBefore } from "date-fns";
import { SLIDE_ANIMATION_MS } from "@/lib/constants/calendar";

/**
 * Drives the slide-in animation class for a period-based calendar view
 * (month or week) when `date` moves into a different period. Shared by
 * MobileCalendar and MobileWeekCalendar — only the period-change
 * comparator differs between them. Pass a comparator declared at module
 * scope (not an inline arrow) so its reference stays stable across
 * renders for the effect's dependency array.
 */
export function useSlideDirection(
  date: Date,
  hasPeriodChanged: (previous: Date, current: Date) => boolean
): string {
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(
    null
  );
  const prevDateRef = useRef<Date>(date);

  useEffect(() => {
    const prevDate = prevDateRef.current;
    if (prevDate && hasPeriodChanged(prevDate, date)) {
      const direction = isBefore(date, prevDate) ? "right" : "left";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Animation trigger derived from `date` prop change plus a timer-based reset. Refactoring to a `key`-prop remount would lose scroll/focus state.
      setSlideDirection(direction);
      setIsAnimating(true);

      const timer = setTimeout(() => {
        setIsAnimating(false);
        setSlideDirection(null);
      }, SLIDE_ANIMATION_MS);

      return () => clearTimeout(timer);
    }
    prevDateRef.current = date;
  }, [date, hasPeriodChanged]);

  if (!isAnimating || !slideDirection) return "";
  return slideDirection === "left"
    ? "animate-slide-in-right"
    : "animate-slide-in-left";
}
