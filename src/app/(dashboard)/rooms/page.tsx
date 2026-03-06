"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoomTable } from "@/components/room/room-table";
import { RoomDialog } from "@/components/room/room-dialog";
import { DeleteRoomDialog } from "@/components/room/delete-room-dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

type RoomType = "SINGLE" | "STANDARD_DOUBLE" | "LARGE_DOUBLE" | "EXTRA_LARGE_DOUBLE" | "KING_SINGLE" | "LARGE_DOUBLE_PLUS";

interface Room {
  id: string;
  roomNumber: string;
  roomType: RoomType | null;
  capacity: number;
  pricePerNight: string | number;
  description: string | null;
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-36 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-56 bg-gray-200 rounded"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-64 bg-gray-200 rounded"></div>
          <div className="h-10 w-28 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th className="text-left px-6 py-3 w-[8%]">Room</th>
              <th className="text-left px-6 py-3 w-[10%]">Capacity</th>
              <th className="text-left px-6 py-3 w-[10%]">Price</th>
              <th className="text-left px-6 py-3">Description</th>
              <th className="text-right px-6 py-3 w-[10%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="h-4 w-8 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-16 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-20 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-48 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-3 border-t bg-gray-50/30">
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function RoomsPage() {
  const { data: session } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isManager = session?.user?.role === "GENERAL_MANAGER";

  const fetchRooms = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      setRooms(data);
      setError("");
    } catch {
      setError("Failed to load rooms");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Delay for skeleton loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleAddRoom = () => {
    setSelectedRoom(null);
    setRoomDialogOpen(true);
  };

  const handleEditRoom = (room: Room) => {
    setSelectedRoom(room);
    setRoomDialogOpen(true);
  };

  const handleDeleteRoom = (room: Room) => {
    setSelectedRoom(room);
    setDeleteDialogOpen(true);
  };

  const handleSubmitRoom = async (data: {
    roomNumber: string;
    roomType?: RoomType;
    capacity: number;
    pricePerNight: number;
    description?: string;
  }) => {
    const url = selectedRoom ? `/api/rooms/${selectedRoom.id}` : "/api/rooms";
    const method = selectedRoom ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to save room");
    }

    toast.success(selectedRoom ? "Room updated successfully" : "Room created successfully");
    await fetchRooms();
  };

  const handleConfirmDelete = async () => {
    if (!selectedRoom) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete room");
      }

      toast.success("Room deleted successfully");
      setDeleteDialogOpen(false);
      await fetchRooms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete room");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter rooms by search query
  const filteredRooms = rooms.filter(
    (room) =>
      room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.roomType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show skeleton while loading
  if (!mounted || isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Hotel Rooms</h1>
          <p className="text-muted-foreground">Manage your hotel room inventory</p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 w-64 bg-white"
            />
          </div>
          {isManager && (
            <Button
              onClick={handleAddRoom}
              className="bg-navy hover:bg-navy-dark text-cream"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Room
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <RoomTable
        rooms={filteredRooms}
        onEdit={handleEditRoom}
        onDelete={handleDeleteRoom}
        isManager={isManager}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      <RoomDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        room={selectedRoom}
        onSubmit={handleSubmitRoom}
      />

      <DeleteRoomDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        roomNumber={selectedRoom?.roomNumber || ""}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
