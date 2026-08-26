/**
 * Display-only event window for the calendar view — mirrors the hotel's
 * check-in style hours (2pm-4pm) but has no bearing on the actual
 * checkInTime/checkOutTime stored on the booking.
 */
export const CALENDAR_EVENT_START_HOUR = 14;
export const CALENDAR_EVENT_END_HOUR = 16;

/**
 * Slide-direction reset delay, in ms. Must stay in sync with the CSS
 * transition duration on the mobile calendar's month/week views.
 */
export const SLIDE_ANIMATION_MS = 300;

/**
 * Initial calendar data fetch window: how many months back / ahead of
 * today to prefetch on page load.
 */
export const CALENDAR_PREFETCH_MONTHS_BACK = 3;
export const CALENDAR_PREFETCH_MONTHS_AHEAD = 6;

/**
 * Sentinel value meaning "no room filter" on the calendar's room-filter
 * dropdown. Shared by the client hook that builds the query string and
 * the service that reads it back.
 */
export const ALL_ROOMS = "all";
