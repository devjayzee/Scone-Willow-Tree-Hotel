"use client";

/**
 * Query key factory for bookings.
 * Provides consistent query keys for TanStack Query cache management.
 */
export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (filters?: { status?: string }) =>
    [...bookingKeys.lists(), filters] as const,
  details: () => [...bookingKeys.all, "detail"] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
};
