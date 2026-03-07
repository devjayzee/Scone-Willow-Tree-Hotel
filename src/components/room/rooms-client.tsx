"use client";

import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoomTable } from "@/components/room/room-table";
import { RoomDialog } from "@/components/room/room-dialog";
import { DeleteRoomDialog } from "@/components/room/delete-room-dialog";
import { Plus, Search, RefreshCw } from "lucide-react";
import { useRoomManagement } from "@/hooks/use-room-management";
import { RoomTableSkeleton } from "@/components/room/room-table-skeleton";
import type { Room } from "@/types/room";

interface RoomsClientProps {
  initialRooms: Room[];
  isManager: boolean;
  fetchTime?: number;
}

export function RoomsClient({ initialRooms, isManager, fetchTime }: RoomsClientProps) {
  const { data: session } = useSession();

  const {
    filteredRooms,
    error,
    isFetching,
    roomDialogOpen,
    deleteDialogOpen,
    selectedRoom,
    isDeleting,
    searchQuery,
    fetchRooms,
    openAddDialog,
    openEditDialog,
    openDeleteDialog,
    saveRoom,
    confirmDelete,
    updateSearch,
    setRoomDialogOpen,
    setDeleteDialogOpen,
  } = useRoomManagement({ initialRooms, fetchTime });

  // Use session role if available (for real-time role changes), fallback to prop
  const canManage = session?.user?.role === "GENERAL_MANAGER" || isManager;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Hotel Rooms</h1>
          <p className="text-muted-foreground">Manage your hotel room inventory</p>
        </div>
        {canManage && (
          <Button
            onClick={openAddDialog}
            className="bg-navy hover:bg-navy-dark text-cream"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Room
          </Button>
        )}
      </div>

      {/* Search and Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => updateSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchRooms()}
          disabled={isFetching}
          title="Refresh rooms"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      {isFetching ? (
        <RoomTableSkeleton />
      ) : (
        <RoomTable
          rooms={filteredRooms}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          isManager={canManage}
        />
      )}

      <RoomDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        room={selectedRoom}
        onSubmit={saveRoom}
      />

      <DeleteRoomDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        roomNumber={selectedRoom?.roomNumber || ""}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
