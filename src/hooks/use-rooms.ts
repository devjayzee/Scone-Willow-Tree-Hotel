"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Room } from "@/types/room";

export interface RoomFormData {
  roomNumber: string;
  capacity: number;
  pricePerNight: number;
  description?: string;
}

// Query key factory for rooms
export const roomKeys = {
  all: ["rooms"] as const,
  lists: () => [...roomKeys.all, "list"] as const,
  list: () => [...roomKeys.lists()] as const,
  details: () => [...roomKeys.all, "detail"] as const,
  detail: (id: string) => [...roomKeys.details(), id] as const,
};

// Fetch all rooms
async function fetchRooms(): Promise<Room[]> {
  const response = await fetch("/api/rooms");
  if (!response.ok) {
    throw new Error("Failed to fetch rooms");
  }
  return response.json();
}

// Create a room
async function createRoom(data: RoomFormData): Promise<Room> {
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

// Update a room
async function updateRoom({
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

// Delete a room
async function deleteRoom(id: string): Promise<void> {
  const response = await fetch(`/api/rooms/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to delete room");
  }
}

// Hook to fetch all rooms
export function useRooms(initialData?: Room[]) {
  return useQuery({
    queryKey: roomKeys.list(),
    queryFn: fetchRooms,
    initialData,
  });
}

// Hook to create a room with optimistic update
export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRoom,
    onMutate: async (newRoomData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: roomKeys.list() });

      // Snapshot the previous value
      const previousRooms = queryClient.getQueryData<Room[]>(roomKeys.list());

      // Optimistically add the new room with a temporary ID
      const optimisticRoom: Room = {
        id: `temp-${Date.now()}`,
        roomNumber: newRoomData.roomNumber,
        capacity: newRoomData.capacity,
        pricePerNight: newRoomData.pricePerNight,
        description: newRoomData.description || null,
      };

      queryClient.setQueryData<Room[]>(roomKeys.list(), (old) => {
        if (!old) return [optimisticRoom];
        // Insert and sort by room number
        const updated = [...old, optimisticRoom];
        return updated.sort((a, b) => {
          const numA = parseInt(a.roomNumber) || 0;
          const numB = parseInt(b.roomNumber) || 0;
          return numA - numB;
        });
      });

      // Return context with the previous value
      return { previousRooms };
    },
    onError: (error: Error, _newRoom, context) => {
      // Rollback to the previous value on error
      if (context?.previousRooms) {
        queryClient.setQueryData(roomKeys.list(), context.previousRooms);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Room created successfully");
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
    },
  });
}

// Hook to update a room with optimistic update
export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRoom,
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: roomKeys.list() });

      // Snapshot the previous value
      const previousRooms = queryClient.getQueryData<Room[]>(roomKeys.list());

      // Optimistically update the room
      queryClient.setQueryData<Room[]>(roomKeys.list(), (old) => {
        if (!old) return old;
        const updated = old.map((room) =>
          room.id === id
            ? {
                ...room,
                roomNumber: data.roomNumber ?? room.roomNumber,
                capacity: data.capacity ?? room.capacity,
                pricePerNight: data.pricePerNight ?? room.pricePerNight,
                description: data.description ?? room.description,
              }
            : room
        );
        // Re-sort in case room number changed
        return updated.sort((a, b) => {
          const numA = parseInt(a.roomNumber) || 0;
          const numB = parseInt(b.roomNumber) || 0;
          return numA - numB;
        });
      });

      return { previousRooms };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousRooms) {
        queryClient.setQueryData(roomKeys.list(), context.previousRooms);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Room updated successfully");
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
    },
  });
}

// Hook to delete a room with optimistic update
export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRoom,
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: roomKeys.list() });

      // Snapshot the previous value
      const previousRooms = queryClient.getQueryData<Room[]>(roomKeys.list());

      // Optimistically remove the room
      queryClient.setQueryData<Room[]>(roomKeys.list(), (old) => {
        if (!old) return old;
        return old.filter((room) => room.id !== deletedId);
      });

      return { previousRooms };
    },
    onError: (error: Error, _deletedId, context) => {
      // Rollback to the previous value on error
      if (context?.previousRooms) {
        queryClient.setQueryData(roomKeys.list(), context.previousRooms);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Room deleted successfully");
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
    },
  });
}
