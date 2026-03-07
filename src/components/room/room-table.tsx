"use client";

import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/ui/table-pagination";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { Pencil, Trash2, Users, DollarSign, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Room } from "@/types/room";

interface RoomTableProps {
  rooms: Room[];
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
  isManager: boolean;
}

export function RoomTable({
  rooms,
  onEdit,
  onDelete,
  isManager,
}: RoomTableProps) {
  // Use shared pagination hook
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedItems: paginatedRooms,
    startIndex,
    endIndex,
    pageSizeOptions,
  } = useTablePagination(rooms, {
    storageKeyPrefix: "rooms",
  });

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return `$${numPrice.toFixed(0)}/night`;
  };

  // Reusable action menu for mobile
  const renderActionMenu = (room: Room) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-gray-600"
          aria-label={`Actions for Room ${room.roomNumber}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(room)}>
          <Pencil className="h-4 w-4 mr-2" aria-hidden="true" />
          Edit Room
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(room)}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
          Delete Room
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (rooms.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-12 text-center" role="status">
        <p className="text-muted-foreground">No rooms found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Mobile Card View */}
      <div className="md:hidden divide-y" role="list" aria-label="Rooms list">
        {paginatedRooms.map((room) => (
          <article
            key={room.id}
            className="p-4 space-y-3"
            aria-label={`Room ${room.roomNumber}`}
          >
            {/* Header: Room Number & Actions */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 text-lg">
                Room {room.roomNumber}
              </span>
              {isManager && renderActionMenu(room)}
            </div>

            {/* Details */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
                <span className="text-gray-600">
                  {room.capacity} {room.capacity === 1 ? "Guest" : "Guests"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-400" aria-hidden="true" />
                <span className="font-medium text-gray-900">
                  {formatPrice(room.pricePerNight)}
                </span>
              </div>
            </div>

            {/* Description */}
            {room.description && (
              <p className="text-sm text-gray-500">{room.description}</p>
            )}
          </article>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full" role="table" aria-label="Rooms table">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th scope="col" className="text-left px-6 py-3">Room</th>
              <th scope="col" className="text-left px-6 py-3">Capacity</th>
              <th scope="col" className="text-left px-6 py-3">Price</th>
              <th scope="col" className="text-left px-6 py-3">Description</th>
              {isManager && (
                <th scope="col" className="text-right px-6 py-3">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedRooms.map((room) => (
              <tr key={room.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium text-gray-900">
                    {room.roomNumber}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {room.capacity} {room.capacity === 1 ? "Guest" : "Guests"}
                </td>
                <td className="px-6 py-4 text-gray-900 font-medium">
                  {formatPrice(room.pricePerNight)}
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm">
                  {room.description || "—"}
                </td>
                {isManager && (
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(room)}
                        className="h-8 w-8 text-gray-400 hover:text-gray-600"
                        aria-label={`Edit Room ${room.roomNumber}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(room)}
                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                        aria-label={`Delete Room ${room.roomNumber}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={rooms.length}
        startIndex={startIndex}
        endIndex={endIndex}
        itemsPerPage={itemsPerPage}
        pageSizeOptions={pageSizeOptions}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        itemLabel="rooms"
      />
    </div>
  );
}
