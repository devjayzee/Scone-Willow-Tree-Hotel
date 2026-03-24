"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TablePagination } from "@/components/ui/table-pagination";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileDown,
  DollarSign,
  LogIn,
  LogOut,
  XCircle,
  Calendar,
  User,
  Home,
} from "lucide-react";
import type { BookingSummary } from "@/types/booking";

interface BookingTableProps<T extends BookingSummary> {
  bookings: T[];
  onView: (booking: T) => void;
  onEdit: (booking: T) => void;
  onDelete: (booking: T) => void;
  onDownloadPDF: (booking: T) => void | Promise<void>;
  onTogglePayment: (booking: T) => void;
  onCheckIn: (booking: T) => void;
  onCheckOut: (booking: T) => void;
  onCancel: (booking: T) => void;
}

export function BookingTable<T extends BookingSummary>({
  bookings,
  onView,
  onEdit,
  onDelete,
  onDownloadPDF,
  onTogglePayment,
  onCheckIn,
  onCheckOut,
  onCancel,
}: BookingTableProps<T>) {
  // Use shared pagination hook
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedItems: paginatedBookings,
    startIndex,
    endIndex,
    pageSizeOptions,
  } = useTablePagination(bookings, {
    storageKeyPrefix: "bookings",
  });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> =
      {
        CONFIRMED: {
          bg: "bg-blue-100",
          text: "text-blue-800",
          label: "Confirmed",
        },
        CHECKED_IN: {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "Checked In",
        },
        CHECKED_OUT: {
          bg: "bg-gray-100",
          text: "text-gray-800",
          label: "Checked Out",
        },
        CANCELLED: {
          bg: "bg-red-100",
          text: "text-red-800",
          label: "Cancelled",
        },
      };
    const style = styles[status] || styles.CONFIRMED;
    return (
      <Badge className={`${style.bg} ${style.text} hover:${style.bg}`}>
        {style.label}
      </Badge>
    );
  };

  // Reusable action menu
  const renderActionMenu = (booking: T) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-gray-600"
          aria-label={`Actions for booking ${booking.bookingRef}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onView(booking)}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        {(booking.status === "CONFIRMED" ||
          booking.status === "CHECKED_IN") && (
          <DropdownMenuItem onClick={() => onEdit(booking)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Booking
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onDownloadPDF(booking)}>
          <FileDown className="mr-2 h-4 w-4" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onTogglePayment(booking)}>
          <DollarSign className="mr-2 h-4 w-4" />
          {booking.isPaid ? "Mark as Unpaid" : "Mark as Paid"}
        </DropdownMenuItem>
        {booking.status === "CONFIRMED" && (
          <DropdownMenuItem
            onClick={() => onCheckIn(booking)}
            className="text-green-600 focus:text-green-600"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Check In
          </DropdownMenuItem>
        )}
        {booking.status === "CHECKED_IN" && (
          <DropdownMenuItem
            onClick={() => onCheckOut(booking)}
            className="text-blue-600 focus:text-blue-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Check Out
          </DropdownMenuItem>
        )}
        {(booking.status === "CONFIRMED" ||
          booking.status === "CHECKED_IN") && (
          <DropdownMenuItem
            onClick={() => onCancel(booking)}
            className="text-orange-600 focus:text-orange-600"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Booking
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(booking)}
          disabled={booking.status !== "CANCELLED"}
          className={
            booking.status === "CANCELLED"
              ? "text-red-600 focus:text-red-600"
              : "text-gray-400 cursor-not-allowed"
          }
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (bookings.length === 0) {
    return (
      <div
        className="bg-white rounded-lg border p-12 text-center"
        role="status"
      >
        <p className="text-muted-foreground">No bookings found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Mobile Card View */}
      <div
        className="md:hidden divide-y"
        role="list"
        aria-label="Bookings list"
      >
        {paginatedBookings.map((booking) => (
          <article
            key={booking.id}
            className="p-4 space-y-3"
            aria-label={`Booking ${booking.bookingRef} for ${booking.guestName}`}
          >
            {/* Header: Ref, Status, Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {booking.bookingRef}
                </span>
                <Badge
                  variant={booking.isPaid ? "default" : "outline"}
                  className={
                    booking.isPaid
                      ? "bg-green-100 text-green-800 hover:bg-green-100 text-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs"
                  }
                  aria-label={
                    booking.isPaid
                      ? "Payment status: Paid"
                      : "Payment status: Unpaid"
                  }
                >
                  {booking.isPaid ? "Paid" : "Unpaid"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(booking.status)}
                {renderActionMenu(booking)}
              </div>
            </div>

            {/* Guest Info */}
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span className="text-gray-900">{booking.guestName}</span>
              <span
                className="text-gray-500"
                aria-label={`Phone: ${booking.guestPhone}`}
              >
                · {booking.guestPhone}
              </span>
            </div>

            {/* Room & Dates */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-gray-400" aria-hidden="true" />
                <span className="text-gray-900">
                  Room {booking.room.roomNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
                <span
                  className="text-gray-600"
                  aria-label={`Stay from ${formatDate(booking.checkIn)} to ${formatDate(booking.checkOut)}`}
                >
                  {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full" role="table" aria-label="Bookings table">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th scope="col" className="text-left px-6 py-3">
                Booking Ref
              </th>
              <th scope="col" className="text-left px-6 py-3">
                Guest
              </th>
              <th scope="col" className="text-left px-6 py-3">
                Room
              </th>
              <th scope="col" className="text-left px-6 py-3">
                Check In
              </th>
              <th scope="col" className="text-left px-6 py-3">
                Check Out
              </th>
              <th scope="col" className="text-center px-6 py-3">
                Status
              </th>
              <th scope="col" className="text-center px-6 py-3">
                Paid
              </th>
              <th scope="col" className="text-right px-6 py-3">
                Actions
              </th>
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
                    <p className="font-medium text-gray-900">
                      {booking.guestName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {booking.guestPhone}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-900">
                    Room {booking.room.roomNumber}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {formatDate(booking.checkIn)}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {formatDate(booking.checkOut)}
                </td>
                <td className="px-6 py-4 text-center">
                  {getStatusBadge(booking.status)}
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
                    {renderActionMenu(booking)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={bookings.length}
        startIndex={startIndex}
        endIndex={endIndex}
        itemsPerPage={itemsPerPage}
        pageSizeOptions={pageSizeOptions}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        itemLabel="bookings"
      />
    </div>
  );
}
