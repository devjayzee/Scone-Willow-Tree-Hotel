"use client";

import { useState, useCallback, useMemo } from "react";
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from "@/hooks/use-rooms";
import type { Room } from "@/types/room";

export interface RoomFormData {
  roomNumber: string;
  capacity: number;
  pricePerNight: number;
  description?: string;
}

interface UseRoomManagementOptions {
  initialRooms: Room[];
}

export function useRoomManagement({ initialRooms }: UseRoomManagementOptions) {
  // TanStack Query hooks
  const { data: rooms = initialRooms, error: queryError, refetch } = useRooms(initialRooms);
  const createMutation = useCreateRoom();
  const updateMutation = useUpdateRoom();
  const deleteMutation = useDeleteRoom();

  // Dialog state
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Derived state
  const error = queryError?.message || "";
  const isDeleting = deleteMutation.isPending;

  // Open add room dialog
  const openAddDialog = useCallback(() => {
    setSelectedRoom(null);
    setRoomDialogOpen(true);
  }, []);

  // Open edit room dialog
  const openEditDialog = useCallback((room: Room) => {
    setSelectedRoom(room);
    setRoomDialogOpen(true);
  }, []);

  // Open delete confirmation dialog
  const openDeleteDialog = useCallback((room: Room) => {
    setSelectedRoom(room);
    setDeleteDialogOpen(true);
  }, []);

  // Close room dialog
  const closeRoomDialog = useCallback(() => {
    setRoomDialogOpen(false);
  }, []);

  // Close delete dialog
  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
  }, []);

  // Create or update a room
  const saveRoom = useCallback(async (data: RoomFormData) => {
    if (selectedRoom) {
      await updateMutation.mutateAsync({ id: selectedRoom.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  }, [selectedRoom, createMutation, updateMutation]);

  // Delete the selected room
  const confirmDelete = useCallback(async () => {
    if (!selectedRoom) return;

    try {
      await deleteMutation.mutateAsync(selectedRoom.id);
      setDeleteDialogOpen(false);
    } catch {
      // Error is handled by the mutation's onError
    }
  }, [selectedRoom, deleteMutation]);

  // Update search and reset pagination
  const updateSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  // Filter rooms by search query
  const filteredRooms = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rooms, searchQuery]);

  return {
    // Room data
    rooms,
    filteredRooms,
    error,

    // Dialog state
    roomDialogOpen,
    deleteDialogOpen,
    selectedRoom,
    isDeleting,

    // Search and pagination
    searchQuery,
    currentPage,
    setCurrentPage,

    // Actions
    fetchRooms: refetch,
    openAddDialog,
    openEditDialog,
    openDeleteDialog,
    closeRoomDialog,
    closeDeleteDialog,
    saveRoom,
    confirmDelete,
    updateSearch,
    setRoomDialogOpen,
    setDeleteDialogOpen,
  };
}
