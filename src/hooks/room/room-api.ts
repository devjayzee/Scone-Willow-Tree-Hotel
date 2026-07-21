"use client";

import type { Room, RoomSummary } from "@/types/room";

export interface RoomFormData {
  roomNumber: string;
  capacity: number;
  pricePerNight: number;
  description?: string;
}

export async function fetchRooms(): Promise<Room[]> {
  const response = await fetch("/api/rooms");
  if (!response.ok) {
    throw new Error("Failed to fetch rooms");
  }
  return response.json();
}

export async function fetchAvailableRooms(
  checkIn: string,
  checkOut: string
): Promise<RoomSummary[]> {
  const response = await fetch(
    `/api/rooms/available?checkIn=${checkIn}&checkOut=${checkOut}`
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch available rooms");
  }
  return response.json();
}

export async function createRoom(data: RoomFormData): Promise<Room> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to create room");
  }

  return response.json();
}

export async function updateRoom({
  id,
  data,
}: {
  id: string;
  data: RoomFormData;
}): Promise<Room> {
  const response = await fetch(`/api/rooms/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update room");
  }

  return response.json();
}

export async function deleteRoom(id: string): Promise<void> {
  const response = await fetch(`/api/rooms/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to delete room");
  }
}
