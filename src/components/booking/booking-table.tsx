"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  DollarSign,
} from "lucide-react";
import type { BookingSummary } from "@/types/booking";

interface BookingTableProps<T extends BookingSummary> {
  bookings: T[];
  onView: (booking: T) => void;
  onDelete: (booking: T) => void;
  onDownloadPDF: (booking: T) => void;
  onTogglePayment: (booking: T) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function BookingTable<T extends BookingSummary>({
  bookings,
  onView,
  onDelete,
  onDownloadPDF,
  onTogglePayment,
  currentPage,
  onPageChange,
}: BookingTableProps<T>) {
  const { data: session } = useSession();
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const storageKey = `bookings-per-page-${session?.user?.id || "default"}`;

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
    const totalPages = Math.ceil(bookings.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      onPageChange(totalPages);
    }
  }, [bookings.length, itemsPerPage, currentPage, onPageChange]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  // Pagination calculations
  const totalPages = Math.ceil(bookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBookings = bookings.slice(startIndex, endIndex);

  const handleItemsPerPageChange = (value: string) => {
    const newValue = parseInt(value);
    setItemsPerPage(newValue);
    onPageChange(1);
    localStorage.setItem(storageKey, value);
  };

  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-12 text-center">
        <p className="text-muted-foreground">No bookings found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
            <th className="text-left px-6 py-3">Booking Ref</th>
            <th className="text-left px-6 py-3">Guest</th>
            <th className="text-left px-6 py-3">Room</th>
            <th className="text-left px-6 py-3">Check In</th>
            <th className="text-left px-6 py-3">Check Out</th>
            <th className="text-center px-6 py-3">Paid</th>
            <th className="text-right px-6 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {paginatedBookings.map((booking) => (
            <tr
              key={booking.id}
              className="hover:bg-gray-50/50 transition-colors"
            >
              <td className="px-6 py-4">
                <span className="font-medium text-gray-900">
                  {booking.bookingRef}
                </span>
              </td>
              <td className="px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900">{booking.guestName}</p>
                  <p className="text-sm text-gray-500">{booking.guestPhone}</p>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-gray-900">Room {booking.room.roomNumber}</span>
              </td>
              <td className="px-6 py-4 text-gray-600">
                {formatDate(booking.checkIn)}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {formatDate(booking.checkOut)}
              </td>
              <td className="px-6 py-4 text-center">
                <Badge
                  variant={booking.isPaid ? "default" : "outline"}
                  className={
                    booking.isPaid
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                  }
                >
                  {booking.isPaid ? "Paid" : "Unpaid"}
                </Badge>
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-gray-600"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onView(booking)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDownloadPDF(booking)}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onTogglePayment(booking)}>
                        <DollarSign className="mr-2 h-4 w-4" />
                        {booking.isPaid ? "Mark as Unpaid" : "Mark as Paid"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(booking)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination Footer */}
      <div className="px-6 py-3 border-t bg-gray-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Show</span>
          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
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
          Showing {startIndex + 1} to {Math.min(endIndex, bookings.length)} of {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
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
