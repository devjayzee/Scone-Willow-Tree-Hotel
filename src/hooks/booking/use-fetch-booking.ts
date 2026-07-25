"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { Booking } from "@/types/booking";
import { bookingKeys } from "./booking-keys";
import { fetchBookingById } from "./booking-api";

/**
 * Fetch a booking on demand and share the result with the query cache.
 * Returns null on failure (error is logged and toasted).
 */
export function useFetchBooking() {
  const queryClient = useQueryClient();

  return useCallback(
    async (id: string): Promise<Booking | null> => {
      try {
        return await queryClient.fetchQuery({
          queryKey: bookingKeys.detail(id),
          queryFn: () => fetchBookingById(id),
          staleTime: 1000 * 30,
        });
      } catch (error) {
        logger.error("Failed to fetch booking details", error, { id });
        toast.error("Failed to fetch booking details");
        return null;
      }
    },
    [queryClient]
  );
}
