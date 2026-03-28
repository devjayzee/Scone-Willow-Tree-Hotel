"use client";

import { useQueryClient, useMutation, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateWithRelated } from "@/lib/query-invalidation";
import type { Booking } from "@/types/booking";
import { bookingKeys } from "./booking-keys";

/**
 * Context returned from onMutate for rollback support.
 */
export interface OptimisticContext {
  previousBookings: Booking[] | undefined;
}

/**
 * Cancels queries and snapshots the current bookings list.
 * Call this at the start of onMutate.
 */
export async function prepareOptimisticUpdate(
  queryClient: QueryClient
): Promise<OptimisticContext> {
  await queryClient.cancelQueries({ queryKey: bookingKeys.list() });
  const previousBookings = queryClient.getQueryData<Booking[]>(bookingKeys.list());
  return { previousBookings };
}

/**
 * Updates a single booking in the cache by ID.
 */
export function updateBookingInCache(
  queryClient: QueryClient,
  id: string,
  updater: (booking: Booking) => Booking
): void {
  queryClient.setQueryData<Booking[]>(bookingKeys.list(), (old) => {
    if (!old) return old;
    return old.map((booking) =>
      booking.id === id ? updater(booking) : booking
    );
  });
}

/**
 * Removes a booking from the cache by ID.
 */
export function removeBookingFromCache(
  queryClient: QueryClient,
  id: string
): void {
  queryClient.setQueryData<Booking[]>(bookingKeys.list(), (old) => {
    if (!old) return old;
    return old.filter((booking) => booking.id !== id);
  });
}

/**
 * Adds a booking to the cache (at the beginning of the list).
 */
export function addBookingToCache(
  queryClient: QueryClient,
  booking: Booking
): void {
  queryClient.setQueryData<Booking[]>(bookingKeys.list(), (old) => {
    if (!old) return [booking];
    return [booking, ...old];
  });
}

/**
 * Rolls back to previous bookings on error.
 */
export function rollbackBookings(
  queryClient: QueryClient,
  context: OptimisticContext | undefined
): void {
  if (context?.previousBookings) {
    queryClient.setQueryData(bookingKeys.list(), context.previousBookings);
  }
}

/**
 * Standard error handler for booking mutations.
 */
export function handleMutationError(
  error: Error,
  queryClient: QueryClient,
  context: OptimisticContext | undefined
): void {
  rollbackBookings(queryClient, context);
  toast.error(error.message);
}

/**
 * Standard settled handler - invalidates bookings and related caches.
 */
export function handleMutationSettled(queryClient: QueryClient): void {
  invalidateWithRelated(queryClient, "bookings");
}

/**
 * Creates an optimistic mutation hook with common boilerplate.
 */
export interface CreateOptimisticMutationOptions<TVariables, TData> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutateOptimistic: (
    variables: TVariables,
    queryClient: QueryClient,
    context: OptimisticContext
  ) => void;
  successMessage: string | ((data: TData) => string);
}

export function useOptimisticBookingMutation<TVariables, TData = Booking>({
  mutationFn,
  onMutateOptimistic,
  successMessage,
}: CreateOptimisticMutationOptions<TVariables, TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      const context = await prepareOptimisticUpdate(queryClient);
      onMutateOptimistic(variables, queryClient, context);
      return context;
    },
    onError: (error: Error, _variables: TVariables, context: OptimisticContext | undefined) => {
      handleMutationError(error, queryClient, context);
    },
    onSuccess: (data: TData) => {
      const message = typeof successMessage === "function"
        ? successMessage(data)
        : successMessage;
      toast.success(message);
    },
    onSettled: () => {
      handleMutationSettled(queryClient);
    },
  });
}
