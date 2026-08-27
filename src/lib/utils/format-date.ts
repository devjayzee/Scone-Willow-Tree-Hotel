import { format, parseISO } from "date-fns";

const EMPTY_DATE_PLACEHOLDER = "___/___/______";
const EMPTY_TIME_PLACEHOLDER = "______";

/**
 * Format an ISO date string (YYYY-MM-DD) as dd/MM/yyyy for form display.
 * Returns a placeholder when the input is empty.
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return EMPTY_DATE_PLACEHOLDER;
  return format(parseISO(dateStr), "dd/MM/yyyy");
}

/**
 * Format a 24-hour time string (HH:mm) as h:mm AM/PM for form display.
 * Returns a placeholder when the input is empty.
 */
export function formatDisplayTime(timeStr: string): string {
  if (!timeStr) return EMPTY_TIME_PLACEHOLDER;
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
