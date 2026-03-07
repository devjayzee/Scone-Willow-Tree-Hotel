"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Booking, CreateBookingInput, UpdateBookingInput } from "@/types/booking";

// Query key factory for bookings
export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (filters?: { status?: string }) =>
    [...bookingKeys.lists(), filters] as const,
  details: () => [...bookingKeys.all, "detail"] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
};

// Fetch all bookings
async function fetchBookings(): Promise<Booking[]> {
  const response = await fetch("/api/bookings");
  if (!response.ok) {
    throw new Error("Failed to fetch bookings");
  }
  return response.json();
}

// Create a booking
async function createBooking(data: CreateBookingInput): Promise<Booking> {
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to create booking");
  }

  return response.json();
}

// Update a booking
async function updateBooking({
  id,
  data,
}: {
  id: string;
  data: UpdateBookingInput;
}): Promise<Booking> {
  const response = await fetch(`/api/bookings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update booking");
  }

  return response.json();
}

// Delete a booking
async function deleteBooking(
  id: string
): Promise<{ deleted: boolean; message: string }> {
  const response = await fetch(`/api/bookings/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to delete booking");
  }

  return response.json();
}

// Perform booking action (check-in, check-out, cancel)
async function performBookingAction({
  id,
  action,
  reason,
}: {
  id: string;
  action: "check-in" | "check-out" | "cancel";
  reason?: string;
}): Promise<Booking> {
  const response = await fetch(`/api/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reason }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Failed to ${action}`);
  }

  return response.json();
}

// Hook to fetch all bookings
export function useBookings(initialData?: Booking[]) {
  return useQuery({
    queryKey: bookingKeys.list(),
    queryFn: fetchBookings,
    initialData,
  });
}

// Hook to create a booking with optimistic update
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBooking,
    onMutate: async (newBookingData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookingKeys.list() });

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData<Booking[]>(
        bookingKeys.list()
      );

      // Optimistically add the new booking with a temporary ID
      const optimisticBooking: Booking = {
        id: `temp-${Date.now()}`,
        bookingRef: `BK-PENDING-${Date.now()}`,
        roomId: newBookingData.roomId,
        guestName: newBookingData.guestName,
        guestDateOfBirth: newBookingData.guestDateOfBirth ?? null,
        guestAddress: newBookingData.guestAddress ?? null,
        guestEmail: newBookingData.guestEmail,
        guestPhone: newBookingData.guestPhone ?? null,
        vehicleRego: newBookingData.vehicleRego ?? null,
        additionalGuests: newBookingData.additionalGuests ?? null,
        checkIn: newBookingData.checkIn,
        checkInTime: newBookingData.checkInTime ?? null,
        checkOut: newBookingData.checkOut,
        checkOutTime: newBookingData.checkOutTime ?? null,
        bondDeposit: newBookingData.bondDeposit ?? null,
        status: "CONFIRMED",
        notes: newBookingData.notes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        room: {
          id: newBookingData.roomId,
          roomNumber: "...",
          capacity: 0,
          pricePerNight: "0",
        },
      };

      queryClient.setQueryData<Booking[]>(bookingKeys.list(), (old) => {
        if (!old) return [optimisticBooking];
        // Insert at the beginning (newest first by check-in date)
        return [optimisticBooking, ...old];
      });

      // Return context with the previous value
      return { previousBookings };
    },
    onError: (error: Error, _newBooking, context) => {
      // Rollback to the previous value on error
      if (context?.previousBookings) {
        queryClient.setQueryData(bookingKeys.list(), context.previousBookings);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Booking created successfully");
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// Hook to update a booking with optimistic update
export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBooking,
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookingKeys.list() });

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData<Booking[]>(
        bookingKeys.list()
      );

      // Optimistically update the booking
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), (old) => {
        if (!old) return old;
        return old.map((booking) =>
          booking.id === id
            ? {
                ...booking,
                guestName: data.guestName ?? booking.guestName,
                guestEmail: data.guestEmail ?? booking.guestEmail,
                guestPhone: data.guestPhone ?? booking.guestPhone,
                guestAddress: data.guestAddress ?? booking.guestAddress,
                checkIn: data.checkIn ?? booking.checkIn,
                checkOut: data.checkOut ?? booking.checkOut,
                status: data.status ?? booking.status,
                notes: data.notes ?? booking.notes,
                updatedAt: new Date().toISOString(),
              }
            : booking
        );
      });

      return { previousBookings };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousBookings) {
        queryClient.setQueryData(bookingKeys.list(), context.previousBookings);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Booking updated successfully");
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// Hook to delete a booking with optimistic update
export function useDeleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBooking,
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookingKeys.list() });

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData<Booking[]>(
        bookingKeys.list()
      );

      // Optimistically remove the booking
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), (old) => {
        if (!old) return old;
        return old.filter((booking) => booking.id !== deletedId);
      });

      return { previousBookings };
    },
    onError: (error: Error, _deletedId, context) => {
      // Rollback to the previous value on error
      if (context?.previousBookings) {
        queryClient.setQueryData(bookingKeys.list(), context.previousBookings);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Booking deleted successfully");
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// Hook to check in a booking with optimistic update
export function useCheckInBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      performBookingAction({ id, action: "check-in" }),
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookingKeys.list() });

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData<Booking[]>(
        bookingKeys.list()
      );

      // Optimistically update the status
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), (old) => {
        if (!old) return old;
        return old.map((booking) =>
          booking.id === id
            ? {
                ...booking,
                status: "CHECKED_IN" as const,
                updatedAt: new Date().toISOString(),
              }
            : booking
        );
      });

      return { previousBookings };
    },
    onError: (error: Error, _id, context) => {
      // Rollback to the previous value on error
      if (context?.previousBookings) {
        queryClient.setQueryData(bookingKeys.list(), context.previousBookings);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Guest checked in successfully");
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// Hook to check out a booking with optimistic update
export function useCheckOutBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      performBookingAction({ id, action: "check-out" }),
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookingKeys.list() });

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData<Booking[]>(
        bookingKeys.list()
      );

      // Optimistically update the status
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), (old) => {
        if (!old) return old;
        return old.map((booking) =>
          booking.id === id
            ? {
                ...booking,
                status: "CHECKED_OUT" as const,
                updatedAt: new Date().toISOString(),
              }
            : booking
        );
      });

      return { previousBookings };
    },
    onError: (error: Error, _id, context) => {
      // Rollback to the previous value on error
      if (context?.previousBookings) {
        queryClient.setQueryData(bookingKeys.list(), context.previousBookings);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Guest checked out successfully");
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// Hook to cancel a booking with optimistic update
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      performBookingAction({ id, action: "cancel", reason }),
    onMutate: async ({ id }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookingKeys.list() });

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData<Booking[]>(
        bookingKeys.list()
      );

      // Optimistically update the status
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), (old) => {
        if (!old) return old;
        return old.map((booking) =>
          booking.id === id
            ? {
                ...booking,
                status: "CANCELLED" as const,
                updatedAt: new Date().toISOString(),
              }
            : booking
        );
      });

      return { previousBookings };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousBookings) {
        queryClient.setQueryData(bookingKeys.list(), context.previousBookings);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Booking cancelled successfully");
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}
