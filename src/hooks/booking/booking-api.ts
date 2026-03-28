"use client";

import type { Booking, CreateBookingInput, UpdateBookingInput } from "@/types/booking";

/**
 * Fetch all bookings from the API.
 */
export async function fetchBookings(): Promise<Booking[]> {
  const response = await fetch("/api/bookings");
  if (!response.ok) {
    throw new Error("Failed to fetch bookings");
  }
  return response.json();
}

/**
 * Create a new booking.
 */
export async function createBookingApi(data: CreateBookingInput): Promise<Booking> {
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

/**
 * Update an existing booking.
 */
export async function updateBookingApi({
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

/**
 * Delete a booking.
 */
export async function deleteBookingApi(
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

export type BookingAction = "check-in" | "check-out" | "undo-checkout" | "cancel" | "undo-cancel" | "toggle-payment";

/**
 * Perform a booking action (check-in, check-out, cancel, toggle-payment).
 */
export async function performBookingAction({
  id,
  action,
  reason,
}: {
  id: string;
  action: BookingAction;
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
