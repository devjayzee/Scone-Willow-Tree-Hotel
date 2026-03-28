"use client";

import { useQuery } from "@tanstack/react-query";
import type { Booking } from "@/types/booking";
import { bookingKeys } from "./booking-keys";
import { fetchBookings } from "./booking-api";

/**
 * Hook to fetch all bookings.
 * Supports initial data from server-side rendering.
 */
export function useBookings(initialData?: Booking[], initialDataUpdatedAt?: number) {
  return useQuery({
    queryKey: bookingKeys.list(),
    queryFn: fetchBookings,
    initialData,
    initialDataUpdatedAt,
    staleTime: 1000 * 30, // 30 seconds - bookings change frequently
  });
}
