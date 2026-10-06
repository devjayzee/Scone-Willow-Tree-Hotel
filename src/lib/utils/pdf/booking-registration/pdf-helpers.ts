import { format, parseISO } from "date-fns";

// Shared PDF layout constants used across the section drawers.
export const PAGE_MARGIN = 25;
export const LABEL_OFFSET = 2;

/**
 * Fetch the hotel logo and convert to base64 for PDF embedding.
 * Returns null if the fetch fails so the caller can render the PDF without it.
 */
export async function getLogoBase64(): Promise<string | null> {
  try {
    // Cache-busting parameter to ensure a fresh logo (updated deployments
    // otherwise get the browser-cached version).
    const response = await fetch(`/logo.png?v=${Date.now()}`);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Format a date string for display in the PDF as `dd/MM/yyyy`.
 * Handles both ISO strings (with `T`) and date-only strings.
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = dateStr.includes("T") ? parseISO(dateStr) : new Date(dateStr);
    return format(date, "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

/**
 * Format a `HH:mm` time string as `h:mm AM/PM`.
 */
export function formatDisplayTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
