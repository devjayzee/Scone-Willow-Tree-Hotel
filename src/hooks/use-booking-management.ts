"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useBookings,
  useCreateBooking,
  useDeleteBooking,
  useCheckInBooking,
  useCheckOutBooking,
  useCancelBooking,
} from "@/hooks/use-bookings";
import type { Booking, CreateBookingInput } from "@/types/booking";
import type { RoomSummary } from "@/types/room";

interface UseBookingManagementOptions {
  initialBookings: Booking[];
  initialRooms: RoomSummary[];
}

export function useBookingManagement({
  initialBookings,
  initialRooms,
}: UseBookingManagementOptions) {
  // TanStack Query hooks
  const {
    data: bookings = initialBookings,
    error: queryError,
    refetch,
  } = useBookings(initialBookings);
  const createMutation = useCreateBooking();
  const deleteMutation = useDeleteBooking();
  const checkInMutation = useCheckInBooking();
  const checkOutMutation = useCheckOutBooking();
  const cancelMutation = useCancelBooking();

  // Room data (static, passed from server)
  const [rooms] = useState<RoomSummary[]>(initialRooms);

  // Dialog state
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Derived state
  const error = queryError?.message || "";
  const isProcessing =
    createMutation.isPending ||
    deleteMutation.isPending ||
    checkInMutation.isPending ||
    checkOutMutation.isPending ||
    cancelMutation.isPending;
  const isCreating = createMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  // Open create dialog
  const openCreateDialog = useCallback(() => {
    setSelectedBooking(null);
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

  // Close booking dialog
  const closeBookingDialog = useCallback(() => {
    setBookingDialogOpen(false);
    setSelectedBooking(null);
  }, []);

  // Close details dialog
  const closeDetailsDialog = useCallback(() => {
    setDetailsDialogOpen(false);
    setSelectedBooking(null);
  }, []);

  // Close delete dialog
  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setSelectedBooking(null);
  }, []);

  // Create a new booking
  const createBooking = useCallback(
    async (data: CreateBookingInput) => {
      await createMutation.mutateAsync(data);
      setBookingDialogOpen(false);
    },
    [createMutation]
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

  // Update search query
  const updateSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  // Filter bookings by search query
  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.bookingRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.guestEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    isDeleting,

    // Search and pagination
    searchQuery,
    currentPage,

    // Actions
    fetchBookings: refetch,
    openCreateDialog,
    openDetailsDialog,
    openDeleteDialog,
    closeBookingDialog,
    closeDetailsDialog,
    closeDeleteDialog,
    createBooking,
    confirmDelete,
    checkInBooking,
    checkOutBooking,
    cancelBooking,
    updateSearch,
    setCurrentPage,
    setBookingDialogOpen,
    setDetailsDialogOpen,
    setDeleteDialogOpen,
  };
}
