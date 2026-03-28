"use client";

import type { Booking, CreateBookingInput, UpdateBookingInput } from "@/types/booking";
import {
  createBookingApi,
  updateBookingApi,
  deleteBookingApi,
  performBookingAction,
} from "./booking-api";
import {
  useOptimisticBookingMutation,
  updateBookingInCache,
  removeBookingFromCache,
  addBookingToCache,
} from "./use-optimistic-booking";

/**
 * Hook to create a booking with optimistic update.
 */
export function useCreateBooking() {
  return useOptimisticBookingMutation({
    mutationFn: createBookingApi,
    onMutateOptimistic: (newBookingData: CreateBookingInput, queryClient) => {
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
        isPaid: false,
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
      addBookingToCache(queryClient, optimisticBooking);
    },
    successMessage: "Booking created successfully",
  });
}

/**
 * Hook to update a booking with optimistic update.
 */
export function useUpdateBooking() {
  return useOptimisticBookingMutation({
    mutationFn: updateBookingApi,
    onMutateOptimistic: ({ id, data }: { id: string; data: UpdateBookingInput }, queryClient) => {
      updateBookingInCache(queryClient, id, (booking) => ({
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
      }));
    },
    successMessage: "Booking updated successfully",
  });
}

/**
 * Hook to delete a booking with optimistic update.
 */
export function useDeleteBooking() {
  return useOptimisticBookingMutation<string, { deleted: boolean; message: string }>({
    mutationFn: deleteBookingApi,
    onMutateOptimistic: (deletedId: string, queryClient) => {
      removeBookingFromCache(queryClient, deletedId);
    },
    successMessage: "Booking deleted successfully",
  });
}

/**
 * Hook to check in a booking with optimistic update.
 */
export function useCheckInBooking() {
  return useOptimisticBookingMutation({
    mutationFn: (id: string) => performBookingAction({ id, action: "check-in" }),
    onMutateOptimistic: (id: string, queryClient) => {
      updateBookingInCache(queryClient, id, (booking) => ({
        ...booking,
        status: "CHECKED_IN" as const,
        updatedAt: new Date().toISOString(),
      }));
    },
    successMessage: "Guest checked in successfully",
  });
}

/**
 * Hook to check out a booking with optimistic update.
 */
export function useCheckOutBooking() {
  return useOptimisticBookingMutation({
    mutationFn: (id: string) => performBookingAction({ id, action: "check-out" }),
    onMutateOptimistic: (id: string, queryClient) => {
      updateBookingInCache(queryClient, id, (booking) => ({
        ...booking,
        status: "CHECKED_OUT" as const,
        updatedAt: new Date().toISOString(),
      }));
    },
    successMessage: "Guest checked out successfully",
  });
}

/**
 * Hook to cancel a booking with optimistic update.
 */
export function useCancelBooking() {
  return useOptimisticBookingMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      performBookingAction({ id, action: "cancel", reason }),
    onMutateOptimistic: ({ id }: { id: string; reason?: string }, queryClient) => {
      updateBookingInCache(queryClient, id, (booking) => ({
        ...booking,
        status: "CANCELLED" as const,
        updatedAt: new Date().toISOString(),
      }));
    },
    successMessage: "Booking cancelled successfully",
  });
}

/**
 * Hook to toggle payment status with optimistic update.
 */
export function useTogglePayment() {
  return useOptimisticBookingMutation({
    mutationFn: (id: string) => performBookingAction({ id, action: "toggle-payment" }),
    onMutateOptimistic: (id: string, queryClient) => {
      updateBookingInCache(queryClient, id, (booking) => ({
        ...booking,
        isPaid: !booking.isPaid,
        updatedAt: new Date().toISOString(),
      }));
    },
    successMessage: (data: Booking) =>
      data.isPaid ? "Booking marked as paid" : "Booking marked as unpaid",
  });
}

/**
 * Hook to undo checkout (revert to checked-in status) with optimistic update.
 * Only allowed if the checkout date has not passed yet.
 */
export function useUndoCheckOutBooking() {
  return useOptimisticBookingMutation({
    mutationFn: (id: string) => performBookingAction({ id, action: "undo-checkout" }),
    onMutateOptimistic: (id: string, queryClient) => {
      updateBookingInCache(queryClient, id, (booking) => ({
        ...booking,
        status: "CHECKED_IN" as const,
        updatedAt: new Date().toISOString(),
      }));
    },
    successMessage: "Checkout undone - guest is now checked in",
  });
}

/**
 * Hook to undo cancellation (revert to confirmed status) with optimistic update.
 * Only allowed if the check-in date has not passed yet.
 */
export function useUndoCancelBooking() {
  return useOptimisticBookingMutation({
    mutationFn: (id: string) => performBookingAction({ id, action: "undo-cancel" }),
    onMutateOptimistic: (id: string, queryClient) => {
      updateBookingInCache(queryClient, id, (booking) => ({
        ...booking,
        status: "CONFIRMED" as const,
        updatedAt: new Date().toISOString(),
      }));
    },
    successMessage: "Cancellation undone - booking is now confirmed",
  });
}
