"use client";

import { BookingDialog } from "@/components/booking/booking-dialog";
import { BookingDetailsDialog } from "@/components/booking/booking-details-dialog";
import { DeleteBookingDialog } from "@/components/booking/delete-booking-dialog";
import type { Booking, CreateBookingInput } from "@/types/booking";
import type { RoomSummary } from "@/types/room";

interface BookingsDialogsProps {
  rooms: RoomSummary[];
  selectedBooking: Booking | null;
  bookingDialogOpen: boolean;
  detailsDialogOpen: boolean;
  deleteDialogOpen: boolean;
  isDeleting: boolean;
  onBookingDialogOpenChange: (open: boolean) => void;
  onDetailsDialogOpenChange: (open: boolean) => void;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateBookingInput) => Promise<void>;
  onConfirmDelete: () => Promise<void>;
}

export function BookingsDialogs({
  rooms,
  selectedBooking,
  bookingDialogOpen,
  detailsDialogOpen,
  deleteDialogOpen,
  isDeleting,
  onBookingDialogOpenChange,
  onDetailsDialogOpenChange,
  onDeleteDialogOpenChange,
  onSubmit,
  onConfirmDelete,
}: BookingsDialogsProps) {
  return (
    <>
      <BookingDialog
        open={bookingDialogOpen}
        onOpenChange={onBookingDialogOpenChange}
        rooms={rooms}
        onSubmit={onSubmit}
        booking={selectedBooking}
      />

      <BookingDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={onDetailsDialogOpenChange}
        booking={selectedBooking}
      />

      <DeleteBookingDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        bookingRef={selectedBooking?.bookingRef || ""}
        guestName={selectedBooking?.guestName || ""}
        onConfirm={onConfirmDelete}
        isLoading={isDeleting}
      />
    </>
  );
}
