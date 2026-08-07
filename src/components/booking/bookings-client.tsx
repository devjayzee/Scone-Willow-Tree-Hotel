"use client";

import { BookingTable } from "@/components/booking/booking-table";
import { BookingTableSkeleton } from "@/components/booking/booking-table-skeleton";
import { BookingsHeader } from "@/components/booking/bookings-header";
import { BookingsToolbar } from "@/components/booking/bookings-toolbar";
import { BookingsDialogs } from "@/components/booking/bookings-dialogs";
import { useBookingManagement } from "@/hooks/use-booking-management";
import type { RoomSummary } from "@/types/room";
import type { Booking } from "@/types/booking";

interface BookingsClientProps {
  initialBookings: Booking[];
  initialRooms: RoomSummary[];
  fetchTime?: number;
}

export function BookingsClient({
  initialBookings,
  initialRooms,
  fetchTime,
}: BookingsClientProps) {
  const {
    filteredBookings,
    rooms,
    error,
    bookingDialogOpen,
    detailsDialogOpen,
    deleteDialogOpen,
    selectedBooking,
    isDeleting,
    searchQuery,
    openCreateDialog,
    openEditDialog,
    openDetailsDialog,
    openDeleteDialog,
    submitBooking,
    confirmDelete,
    togglePayment,
    checkInBooking,
    checkOutBooking,
    undoCheckOutBooking,
    cancelBooking,
    undoCancelBooking,
    updateSearch,
    fetchBookings,
    isLoading,
    isFetching,
    setBookingDialogOpen,
    setDetailsDialogOpen,
    setDeleteDialogOpen,
  } = useBookingManagement({ initialBookings, initialRooms, fetchTime });

  return (
    <div className="space-y-6">
      <BookingsHeader onCreateClick={openCreateDialog} />

      <BookingsToolbar
        searchQuery={searchQuery}
        onSearchChange={updateSearch}
        onRefresh={fetchBookings}
        isFetching={isFetching}
      />

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      {isLoading ? (
        <BookingTableSkeleton />
      ) : (
        <BookingTable
          bookings={filteredBookings}
          onView={openDetailsDialog}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          onTogglePayment={togglePayment}
          onCheckIn={(booking) => checkInBooking(booking.id)}
          onCheckOut={(booking) => checkOutBooking(booking.id)}
          onUndoCheckOut={(booking) => undoCheckOutBooking(booking.id)}
          onCancel={(booking) => cancelBooking(booking.id)}
          onUndoCancel={(booking) => undoCancelBooking(booking.id)}
        />
      )}

      <BookingsDialogs
        rooms={rooms}
        selectedBooking={selectedBooking}
        bookingDialogOpen={bookingDialogOpen}
        detailsDialogOpen={detailsDialogOpen}
        deleteDialogOpen={deleteDialogOpen}
        isDeleting={isDeleting}
        onBookingDialogOpenChange={setBookingDialogOpen}
        onDetailsDialogOpenChange={setDetailsDialogOpen}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        onSubmit={submitBooking}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
}
