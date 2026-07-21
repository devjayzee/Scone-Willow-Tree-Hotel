"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateWithRelated } from "@/lib/query-invalidation";
import type { Room } from "@/types/room";
import { createRoom, updateRoom, deleteRoom } from "./room-api";
import { roomKeys } from "./room-keys";

function sortByRoomNumber(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    const numA = parseInt(a.roomNumber) || 0;
    const numB = parseInt(b.roomNumber) || 0;
    return numA - numB;
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRoom,
    onMutate: async (newRoomData) => {
      await queryClient.cancelQueries({ queryKey: roomKeys.list() });

      const previousRooms = queryClient.getQueryData<Room[]>(roomKeys.list());

      const optimisticRoom: Room = {
        id: `temp-${Date.now()}`,
        roomNumber: newRoomData.roomNumber,
        capacity: newRoomData.capacity,
        pricePerNight: newRoomData.pricePerNight,
        description: newRoomData.description || null,
      };

      queryClient.setQueryData<Room[]>(roomKeys.list(), (old) => {
        if (!old) return [optimisticRoom];
        return sortByRoomNumber([...old, optimisticRoom]);
      });

      return { previousRooms };
    },
    onError: (error: Error, _newRoom, context) => {
      if (context?.previousRooms) {
        queryClient.setQueryData(roomKeys.list(), context.previousRooms);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Room created successfully");
    },
    onSettled: () => {
      invalidateWithRelated(queryClient, "rooms");
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRoom,
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: roomKeys.list() });

      const previousRooms = queryClient.getQueryData<Room[]>(roomKeys.list());

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
        return sortByRoomNumber(updated);
      });

      return { previousRooms };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousRooms) {
        queryClient.setQueryData(roomKeys.list(), context.previousRooms);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Room updated successfully");
    },
    onSettled: () => {
      invalidateWithRelated(queryClient, "rooms");
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRoom,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: roomKeys.list() });

      const previousRooms = queryClient.getQueryData<Room[]>(roomKeys.list());

      queryClient.setQueryData<Room[]>(roomKeys.list(), (old) => {
        if (!old) return old;
        return old.filter((room) => room.id !== deletedId);
      });

      return { previousRooms };
    },
    onError: (error: Error, _deletedId, context) => {
      if (context?.previousRooms) {
        queryClient.setQueryData(roomKeys.list(), context.previousRooms);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Room deleted successfully");
    },
    onSettled: () => {
      invalidateWithRelated(queryClient, "rooms");
    },
  });
}
