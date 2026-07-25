"use client";

import { useQuery } from "@tanstack/react-query";
import type { Room } from "@/types/room";
import { fetchRooms, fetchAvailableRooms } from "./room-api";
import { roomKeys } from "./room-keys";

export function useRooms(
  initialData?: Room[],
  initialDataUpdatedAt?: number
) {
  return useQuery({
    queryKey: roomKeys.list(),
    queryFn: fetchRooms,
    initialData,
    initialDataUpdatedAt,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAvailableRooms(checkIn: string, checkOut: string) {
  return useQuery({
    queryKey: roomKeys.available(checkIn, checkOut),
    queryFn: () => fetchAvailableRooms(checkIn, checkOut),
    enabled: Boolean(checkIn && checkOut),
    staleTime: 1000 * 30,
  });
}
