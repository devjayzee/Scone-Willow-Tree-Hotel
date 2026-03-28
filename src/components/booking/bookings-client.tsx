"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookingTable } from "@/components/booking/booking-table";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { BookingDetailsDialog } from "@/components/booking/booking-details-dialog";
import { DeleteBookingDialog } from "@/components/booking/delete-booking-dialog";
import { Plus, Search, RefreshCw } from "lucide-react";
import { useBookingManagement } from "@/hooks/use-booking-management";
import { BookingTableSkeleton } from "@/components/booking/booking-table-skeleton";
import { downloadBookingPDF } from "@/lib/utils/pdf/booking-registration";
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
    isFetching,
    setBookingDialogOpen,
    setDetailsDialogOpen,
    setDeleteDialogOpen,
  } = useBookingManagement({ initialBookings, initialRooms, fetchTime });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Bookings</h1>
          <p className="text-muted-foreground">Manage guest reservations</p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-navy hover:bg-navy-dark text-cream"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Booking
        </Button>
      </div>

      {/* Search and Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => updateSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchBookings()}
          disabled={isFetching}
          title="Refresh bookings"
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
        <BookingTableSkeleton />
      ) : (
        <BookingTable
          bookings={filteredBookings}
          onView={openDetailsDialog}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          onDownloadPDF={downloadBookingPDF}
          onTogglePayment={togglePayment}
          onCheckIn={(booking) => checkInBooking(booking.id)}
          onCheckOut={(booking) => checkOutBooking(booking.id)}
          onUndoCheckOut={(booking) => undoCheckOutBooking(booking.id)}
          onCancel={(booking) => cancelBooking(booking.id)}
          onUndoCancel={(booking) => undoCancelBooking(booking.id)}
        />
      )}

      <BookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        rooms={rooms}
        onSubmit={submitBooking}
        booking={selectedBooking}
      />

      <BookingDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        booking={selectedBooking}
      />

      <DeleteBookingDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        bookingRef={selectedBooking?.bookingRef || ""}
        guestName={selectedBooking?.guestName || ""}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
