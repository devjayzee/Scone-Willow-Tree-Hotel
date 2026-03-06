"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookingTable } from "@/components/booking/booking-table";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { BookingDetailsDialog } from "@/components/booking/booking-details-dialog";
import { DeleteBookingDialog } from "@/components/booking/delete-booking-dialog";
import { Plus, Search } from "lucide-react";
import { useBookingManagement } from "@/hooks/use-booking-management";
import { downloadBookingPDF } from "@/lib/utils/pdf/booking-registration";
import type { RoomSummary } from "@/types/room";
import type { Booking } from "@/types/booking";

interface BookingsClientProps {
  initialBookings: Booking[];
  initialRooms: RoomSummary[];
}

export function BookingsClient({
  initialBookings,
  initialRooms,
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
    currentPage,
    openCreateDialog,
    openDetailsDialog,
    openDeleteDialog,
    createBooking,
    confirmDelete,
    updateSearch,
    setCurrentPage,
    setBookingDialogOpen,
    setDetailsDialogOpen,
    setDeleteDialogOpen,
  } = useBookingManagement({ initialBookings, initialRooms });

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

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search bookings..."
          value={searchQuery}
          onChange={(e) => updateSearch(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <BookingTable
        bookings={filteredBookings}
        onView={openDetailsDialog}
        onDelete={openDeleteDialog}
        onDownloadPDF={downloadBookingPDF}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      <BookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        rooms={rooms}
        onSubmit={createBooking}
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
