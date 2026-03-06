"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { Room } from "@/types/room";

interface RoomTableProps {
  rooms: Room[];
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
  isManager: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function RoomTable({
  rooms,
  onEdit,
  onDelete,
  isManager,
  currentPage,
  onPageChange,
}: RoomTableProps) {
  const { data: session } = useSession();
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const storageKey = `rooms-per-page-${session?.user?.id || "default"}`;

  // Load saved preference on mount
  useEffect(() => {
    if (session?.user?.id) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved);
        if ([10, 20, 50].includes(parsed)) {
          setItemsPerPage(parsed);
        }
      }
    }
  }, [session?.user?.id, storageKey]);

  // Adjust current page if it exceeds total pages after data changes
  useEffect(() => {
    const totalPages = Math.ceil(rooms.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      onPageChange(totalPages);
    }
  }, [rooms.length, itemsPerPage, currentPage, onPageChange]);

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return `$${numPrice.toFixed(0)}/night`;
  };

  // Pagination calculations
  const totalPages = Math.ceil(rooms.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRooms = rooms.slice(startIndex, endIndex);

  const handleItemsPerPageChange = (value: string) => {
    const newValue = parseInt(value);
    setItemsPerPage(newValue);
    onPageChange(1);
    localStorage.setItem(storageKey, value);
  };

  if (rooms.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-12 text-center">
        <p className="text-muted-foreground">No rooms found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
            <th className="text-left px-6 py-3 w-[8%]">Room</th>
            <th className="text-left px-6 py-3 w-[10%]">Capacity</th>
            <th className="text-left px-6 py-3 w-[10%]">Price</th>
            <th className="text-left px-6 py-3">Description</th>
            {isManager && (
              <th className="text-right px-6 py-3 w-[10%]">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {paginatedRooms.map((room) => (
            <tr key={room.id} className="hover:bg-gray-50/50 transition-colors">
              {/* Room Number */}
              <td className="px-6 py-4">
                <span className="font-medium text-gray-900">
                  {room.roomNumber}
                </span>
              </td>

              {/* Capacity */}
              <td className="px-6 py-4 text-gray-600">
                {room.capacity} {room.capacity === 1 ? "Guest" : "Guests"}
              </td>

              {/* Price */}
              <td className="px-6 py-4 text-gray-900 font-medium">
                {formatPrice(room.pricePerNight)}
              </td>

              {/* Description */}
              <td className="px-6 py-4 text-gray-500 text-sm">
                {room.description || "—"}
              </td>

              {/* Actions */}
              {isManager && (
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(room)}
                      className="h-8 w-8 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(room)}
                      className="h-8 w-8 text-gray-400 hover:text-red-600"
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

      {/* Pagination Footer */}
      <div className="px-6 py-3 border-t bg-gray-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Show</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={handleItemsPerPageChange}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>per page</span>
        </div>

        <div className="text-sm text-gray-500">
          Showing {startIndex + 1} to {Math.min(endIndex, rooms.length)} of{" "}
          {rooms.length} rooms
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="icon"
              className={`h-8 w-8 ${currentPage === page ? "bg-navy hover:bg-navy-dark text-cream" : ""}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ))}

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
