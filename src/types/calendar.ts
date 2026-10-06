/**
 * Calendar Types
 *
 * Shared types for calendar-related data structures.
 */

import { BookingStatus } from "@prisma/client";

/**
 * Resource data attached to a calendar event
 */
export interface CalendarEventResource {
  bookingRef: string;
  guestName: string;
  guestPhone: string;
  roomNumber: string;
  roomId: string;
  status: BookingStatus;
}

/**
 * Calendar event representing a booking
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  resource: CalendarEventResource;
}

