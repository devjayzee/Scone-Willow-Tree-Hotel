"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useBookings,
  useCreateBooking,
  useUpdateBooking,
  useDeleteBooking,
  useCheckInBooking,
  useCheckOutBooking,
  useCancelBooking,
  useTogglePayment,
} from "@/hooks/use-bookings";
import type { Booking, CreateBookingInput } from "@/types/booking";
import type { RoomSummary } from "@/types/room";

interface UseBookingManagementOptions {
  initialBookings: Booking[];
  initialRooms: RoomSummary[];
  fetchTime?: number;
}

export function useBookingManagement({
  initialBookings,
  initialRooms,
  fetchTime,
}: UseBookingManagementOptions) {
  // TanStack Query hooks
  const {
    data: bookings = initialBookings,
    error: queryError,
    isFetching,
    refetch,
  } = useBookings(initialBookings, fetchTime);
  const createMutation = useCreateBooking();
  const updateMutation = useUpdateBooking();
  const deleteMutation = useDeleteBooking();
  const checkInMutation = useCheckInBooking();
  const checkOutMutation = useCheckOutBooking();
  const cancelMutation = useCancelBooking();
  const togglePaymentMutation = useTogglePayment();

  // Room data (static, passed from server)
  const [rooms] = useState<RoomSummary[]>(initialRooms);

  // Dialog state
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Derived state
  const error = queryError?.message || "";
  const isProcessing =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    checkInMutation.isPending ||
    checkOutMutation.isPending ||
    cancelMutation.isPending ||
    togglePaymentMutation.isPending;
  const isCreating = createMutation.isPending;
  const isUpdating = updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  // Open create dialog
  const openCreateDialog = useCallback(() => {
    setSelectedBooking(null);
    setBookingDialogOpen(true);
  }, []);

  // Open edit dialog
  const openEditDialog = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setBookingDialogOpen(true);
  }, []);

  // Open details dialog
  const openDetailsDialog = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setDetailsDialogOpen(true);
  }, []);

  // Open delete confirmation dialog
  const openDeleteDialog = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setDeleteDialogOpen(true);
  }, []);

  // Create or update a booking
  const submitBooking = useCallback(
    async (data: CreateBookingInput) => {
      if (selectedBooking) {
        // Update existing booking
        await updateMutation.mutateAsync({
          id: selectedBooking.id,
          data: {
            roomId: data.roomId,
            guestName: data.guestName,
            guestDateOfBirth: data.guestDateOfBirth,
            guestAddress: data.guestAddress,
            guestPhone: data.guestPhone,
            guestEmail: data.guestEmail,
            vehicleRego: data.vehicleRego,
            additionalGuests: data.additionalGuests,
            checkIn: data.checkIn,
            checkInTime: data.checkInTime,
            checkOut: data.checkOut,
            checkOutTime: data.checkOutTime,
            bondDeposit: data.bondDeposit,
            notes: data.notes,
          },
        });
      } else {
        // Create new booking
        await createMutation.mutateAsync(data);
      }
      setBookingDialogOpen(false);
      setSelectedBooking(null);
    },
    [selectedBooking, createMutation, updateMutation]
  );

  // Delete a booking
  const confirmDelete = useCallback(async () => {
    if (!selectedBooking) return;

    try {
      await deleteMutation.mutateAsync(selectedBooking.id);
      setDeleteDialogOpen(false);
      setSelectedBooking(null);
    } catch {
      // Error is handled by the mutation's onError
    }
  }, [selectedBooking, deleteMutation]);

  // Check in a booking
  const checkInBooking = useCallback(
    async (bookingId: string) => {
      await checkInMutation.mutateAsync(bookingId);
    },
    [checkInMutation]
  );

  // Check out a booking
  const checkOutBooking = useCallback(
    async (bookingId: string) => {
      await checkOutMutation.mutateAsync(bookingId);
    },
    [checkOutMutation]
  );

  // Cancel a booking
  const cancelBooking = useCallback(
    async (bookingId: string, reason?: string) => {
      await cancelMutation.mutateAsync({ id: bookingId, reason });
    },
    [cancelMutation]
  );

  // Toggle payment status
  const togglePayment = useCallback(
    async (booking: Booking) => {
      await togglePaymentMutation.mutateAsync(booking.id);
    },
    [togglePaymentMutation]
  );

  // Update search query
  const updateSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Filter bookings by search query
  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.bookingRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.guestPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.room.roomNumber.includes(searchQuery)
    );
  }, [bookings, searchQuery]);

  return {
    // Booking data
    bookings,
    filteredBookings,
    rooms,
    error,

    // Dialog state
    bookingDialogOpen,
    detailsDialogOpen,
    deleteDialogOpen,
    selectedBooking,
    isProcessing,
    isCreating,
    isUpdating,
    isDeleting,
    isFetching,

    // Search
    searchQuery,

    // Actions
    fetchBookings: refetch,
    openCreateDialog,
    openEditDialog,
    openDetailsDialog,
    openDeleteDialog,
    submitBooking,
    confirmDelete,
    checkInBooking,
    checkOutBooking,
    cancelBooking,
    togglePayment,
    updateSearch,
    setBookingDialogOpen,
    setDetailsDialogOpen,
    setDeleteDialogOpen,
  };
}
