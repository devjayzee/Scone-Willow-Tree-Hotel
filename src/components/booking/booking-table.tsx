"use client";

import { TablePagination } from "@/components/ui/table-pagination";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { Calendar, User, Home } from "lucide-react";
import type { BookingSummary } from "@/types/booking";
import {
  BOOKING_COLUMNS,
  BookingStatusBadge,
  PaymentStatusBadge,
  formatBookingDate,
} from "./booking-table-columns";
import { BookingTableActions } from "./booking-table-actions";

interface BookingTableProps<T extends BookingSummary> {
  bookings: T[];
  onView: (booking: T) => void;
  onEdit: (booking: T) => void;
  onDelete: (booking: T) => void;
  onTogglePayment: (booking: T) => void;
  onCheckIn: (booking: T) => void;
  onCheckOut: (booking: T) => void;
  onUndoCheckOut: (booking: T) => void;
  onCancel: (booking: T) => void;
  onUndoCancel: (booking: T) => void;
}

export function BookingTable<T extends BookingSummary>({
  bookings,
  onView,
  onEdit,
  onDelete,
  onTogglePayment,
  onCheckIn,
  onCheckOut,
  onUndoCheckOut,
  onCancel,
  onUndoCancel,
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

  // Action handlers object to pass to BookingTableActions
  const actionHandlers = {
    onView,
    onEdit,
    onDelete,
    onTogglePayment,
    onCheckIn,
    onCheckOut,
    onUndoCheckOut,
    onCancel,
    onUndoCancel,
  };

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
                <PaymentStatusBadge isPaid={booking.isPaid} size="small" />
              </div>
              <div className="flex items-center gap-2">
                <BookingStatusBadge status={booking.status} />
                <BookingTableActions booking={booking} {...actionHandlers} />
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
                  aria-label={`Stay from ${formatBookingDate(booking.checkIn)} to ${formatBookingDate(booking.checkOut)}`}
                >
                  {formatBookingDate(booking.checkIn)} - {formatBookingDate(booking.checkOut)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full table-fixed" role="table" aria-label="Bookings table">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              {BOOKING_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`${col.align} px-6 py-3 ${col.width}`}
                >
                  {col.label}
                </th>
              ))}
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
                  {formatBookingDate(booking.checkIn)}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {formatBookingDate(booking.checkOut)}
                </td>
                <td className="px-6 py-4 text-center">
                  <BookingStatusBadge status={booking.status} />
                </td>
                <td className="px-6 py-4 text-center">
                  <PaymentStatusBadge isPaid={booking.isPaid} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end">
                    <BookingTableActions booking={booking} {...actionHandlers} />
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
