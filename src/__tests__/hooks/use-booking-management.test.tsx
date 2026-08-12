import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock every booking-hook the composition hook stitches together
// (Rule 8 — mock at the module edge). Each mutation exposes
// mutateAsync + isPending flag that individual tests override to
// exercise the aggregate isProcessing OR-fold.
const makeMutation = () => ({
  mutateAsync: vi.fn(),
  isPending: false,
});
const mockUseBookings = vi.fn();
const mockCreate = makeMutation();
const mockUpdate = makeMutation();
const mockDelete = makeMutation();
const mockCheckIn = makeMutation();
const mockCheckOut = makeMutation();
const mockUndoCheckOut = makeMutation();
const mockCancel = makeMutation();
const mockUndoCancel = makeMutation();
const mockTogglePayment = makeMutation();

vi.mock("@/hooks/booking", () => ({
  useBookings: (...args: unknown[]) => mockUseBookings(...args),
  useCreateBooking: () => mockCreate,
  useUpdateBooking: () => mockUpdate,
  useDeleteBooking: () => mockDelete,
  useCheckInBooking: () => mockCheckIn,
  useCheckOutBooking: () => mockCheckOut,
  useUndoCheckOutBooking: () => mockUndoCheckOut,
  useCancelBooking: () => mockCancel,
  useUndoCancelBooking: () => mockUndoCancel,
  useTogglePayment: () => mockTogglePayment,
}));

import type { Booking, CreateBookingInput } from "@/types/booking";
import type { RoomSummary } from "@/types/room";
import { useBookingManagement } from "@/hooks/use-booking-management";

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    bookingRef: "BK-20260501-001",
    roomId: "r-1",
    guestName: "Jane Smith",
    guestPhone: "0400111222",
    checkIn: "2026-05-01",
    checkOut: "2026-05-05",
    ratePerNight: "120",
    status: "CONFIRMED",
    isPaid: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    room: { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "120" },
    ...overrides,
  };
}

const rooms: RoomSummary[] = [
  { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "120", description: null },
];

const createInput: CreateBookingInput = {
  roomId: "r-1",
  guestName: "New Guest",
  guestPhone: "0400111222",
  checkIn: "2026-06-01",
  checkOut: "2026-06-05",
};

function setup(initialBookings: Booking[] = []) {
  mockUseBookings.mockReturnValue({
    data: initialBookings,
    error: null,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  });
  return renderHook(() =>
    useBookingManagement({
      initialBookings,
      initialRooms: rooms,
    }),
  );
}

describe("useBookingManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset isPending flags between tests.
    mockCreate.isPending = false;
    mockUpdate.isPending = false;
    mockDelete.isPending = false;
    mockCheckIn.isPending = false;
    mockCheckOut.isPending = false;
    mockUndoCheckOut.isPending = false;
    mockCancel.isPending = false;
    mockUndoCancel.isPending = false;
    mockTogglePayment.isPending = false;
  });

  describe("dialog open callbacks", () => {
    it("openCreateDialog clears selection and opens the booking dialog", () => {
      const { result } = setup();
      act(() => result.current.openCreateDialog());

      expect(result.current.selectedBooking).toBeNull();
      expect(result.current.bookingDialogOpen).toBe(true);
    });

    it("openEditDialog selects a booking and opens the booking dialog", () => {
      const b = makeBooking();
      const { result } = setup();
      act(() => result.current.openEditDialog(b));

      expect(result.current.selectedBooking).toBe(b);
      expect(result.current.bookingDialogOpen).toBe(true);
    });

    it("openDetailsDialog selects a booking and opens the details dialog", () => {
      const b = makeBooking();
      const { result } = setup();
      act(() => result.current.openDetailsDialog(b));

      expect(result.current.selectedBooking).toBe(b);
      expect(result.current.detailsDialogOpen).toBe(true);
    });

    it("openDeleteDialog selects a booking and opens the delete dialog", () => {
      const b = makeBooking();
      const { result } = setup();
      act(() => result.current.openDeleteDialog(b));

      expect(result.current.selectedBooking).toBe(b);
      expect(result.current.deleteDialogOpen).toBe(true);
    });
  });

  describe("submitBooking", () => {
    it("calls createMutation when no booking is selected", async () => {
      mockCreate.mutateAsync.mockResolvedValue(makeBooking());
      const { result } = setup();

      await act(async () => {
        await result.current.submitBooking(createInput);
      });

      expect(mockCreate.mutateAsync).toHaveBeenCalledWith(createInput);
      expect(mockUpdate.mutateAsync).not.toHaveBeenCalled();
      expect(result.current.bookingDialogOpen).toBe(false);
      expect(result.current.selectedBooking).toBeNull();
    });

    it("calls updateMutation with mapped fields when a booking is selected", async () => {
      mockUpdate.mutateAsync.mockResolvedValue(makeBooking());
      const existing = makeBooking({ id: "b-existing" });
      const { result } = setup();
      act(() => result.current.openEditDialog(existing));

      await act(async () => {
        await result.current.submitBooking(createInput);
      });

      expect(mockUpdate.mutateAsync).toHaveBeenCalledWith({
        id: "b-existing",
        data: expect.objectContaining({
          roomId: createInput.roomId,
          guestName: createInput.guestName,
          guestPhone: createInput.guestPhone,
          checkIn: createInput.checkIn,
          checkOut: createInput.checkOut,
        }),
      });
      expect(mockCreate.mutateAsync).not.toHaveBeenCalled();
      expect(result.current.bookingDialogOpen).toBe(false);
      expect(result.current.selectedBooking).toBeNull();
    });
  });

  describe("confirmDelete", () => {
    it("short-circuits when nothing is selected", async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockDelete.mutateAsync).not.toHaveBeenCalled();
    });

    it("deletes the selected booking then closes + clears", async () => {
      mockDelete.mutateAsync.mockResolvedValue(undefined);
      const b = makeBooking({ id: "b-to-delete" });
      const { result } = setup();
      act(() => result.current.openDeleteDialog(b));

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockDelete.mutateAsync).toHaveBeenCalledWith("b-to-delete");
      expect(result.current.deleteDialogOpen).toBe(false);
      expect(result.current.selectedBooking).toBeNull();
    });

    it("swallows a mutation error — dialog handling stays with the mutation's onError", async () => {
      mockDelete.mutateAsync.mockRejectedValue(new Error("boom"));
      const b = makeBooking();
      const { result } = setup();
      act(() => result.current.openDeleteDialog(b));

      await act(async () => {
        await result.current.confirmDelete();
      });

      // No throw escaped the hook. Dialog remains open so the toast is
      // visible against the correct context.
      expect(mockDelete.mutateAsync).toHaveBeenCalledTimes(1);
      expect(result.current.deleteDialogOpen).toBe(true);
    });
  });

  describe("status-transition action pass-throughs", () => {
    it("checkInBooking forwards to the check-in mutation", async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.checkInBooking("b-1");
      });
      expect(mockCheckIn.mutateAsync).toHaveBeenCalledWith("b-1");
    });

    it("checkOutBooking forwards to the check-out mutation", async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.checkOutBooking("b-1");
      });
      expect(mockCheckOut.mutateAsync).toHaveBeenCalledWith("b-1");
    });

    it("undoCheckOutBooking forwards to the undo-check-out mutation", async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.undoCheckOutBooking("b-1");
      });
      expect(mockUndoCheckOut.mutateAsync).toHaveBeenCalledWith("b-1");
    });

    it("cancelBooking forwards id + optional reason to the cancel mutation", async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.cancelBooking("b-1", "guest requested");
      });
      expect(mockCancel.mutateAsync).toHaveBeenCalledWith({
        id: "b-1",
        reason: "guest requested",
      });
    });

    it("undoCancelBooking forwards to the undo-cancel mutation", async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.undoCancelBooking("b-1");
      });
      expect(mockUndoCancel.mutateAsync).toHaveBeenCalledWith("b-1");
    });

    it("togglePayment forwards the booking id to the toggle-payment mutation", async () => {
      const b = makeBooking({ id: "b-toggle" });
      const { result } = setup();
      await act(async () => {
        await result.current.togglePayment(b);
      });
      expect(mockTogglePayment.mutateAsync).toHaveBeenCalledWith("b-toggle");
    });
  });

  describe("isProcessing aggregate", () => {
    it("is false when no mutation is pending", () => {
      const { result } = setup();
      expect(result.current.isProcessing).toBe(false);
    });

    it("becomes true when any single mutation is pending (OR-fold)", () => {
      mockCancel.isPending = true;
      const { result } = setup();
      expect(result.current.isProcessing).toBe(true);
    });

    it("isCreating / isUpdating / isDeleting map to their individual flags", () => {
      mockCreate.isPending = true;
      mockUpdate.isPending = false;
      mockDelete.isPending = false;
      const { result } = setup();
      expect(result.current.isCreating).toBe(true);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isDeleting).toBe(false);
    });
  });

  describe("search + filter", () => {
    it("filteredBookings returns all bookings when query is empty", () => {
      const bookings = [
        makeBooking({ id: "b-a", bookingRef: "BK-A" }),
        makeBooking({ id: "b-b", bookingRef: "BK-B" }),
      ];
      const { result } = setup(bookings);

      expect(result.current.filteredBookings).toHaveLength(2);
    });

    it("filters case-insensitively by bookingRef", () => {
      const bookings = [
        makeBooking({ id: "b-a", bookingRef: "BK-ALPHA" }),
        makeBooking({ id: "b-b", bookingRef: "BK-BETA" }),
      ];
      const { result } = setup(bookings);

      act(() => result.current.updateSearch("alpha"));

      expect(result.current.filteredBookings).toHaveLength(1);
      expect(result.current.filteredBookings[0].bookingRef).toBe("BK-ALPHA");
    });

    it("filters by guestName", () => {
      const bookings = [
        makeBooking({ id: "b-a", guestName: "Alice" }),
        makeBooking({ id: "b-b", guestName: "Bob" }),
      ];
      const { result } = setup(bookings);

      act(() => result.current.updateSearch("bob"));

      expect(result.current.filteredBookings).toHaveLength(1);
      expect(result.current.filteredBookings[0].guestName).toBe("Bob");
    });

    it("filters by guestPhone substring", () => {
      const bookings = [
        makeBooking({ id: "b-a", guestPhone: "0400111222" }),
        makeBooking({ id: "b-b", guestPhone: "0499999999" }),
      ];
      const { result } = setup(bookings);

      act(() => result.current.updateSearch("0400"));

      expect(result.current.filteredBookings).toHaveLength(1);
      expect(result.current.filteredBookings[0].guestPhone).toBe("0400111222");
    });

    it("filters by room.roomNumber", () => {
      // bookingRef defaults contain digits — override so "007" only
      // matches on room number, not on the ref substring.
      const bookings = [
        makeBooking({
          id: "b-a",
          bookingRef: "BK-A",
          room: { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "100" },
        }),
        makeBooking({
          id: "b-b",
          bookingRef: "BK-B",
          room: { id: "r-2", roomNumber: "007", capacity: 2, pricePerNight: "100" },
        }),
      ];
      const { result } = setup(bookings);

      act(() => result.current.updateSearch("007"));

      expect(result.current.filteredBookings).toHaveLength(1);
      expect(result.current.filteredBookings[0].room.roomNumber).toBe("007");
    });

    it("updateSearch mirrors the query into state", () => {
      const { result } = setup();
      act(() => result.current.updateSearch("hello"));
      expect(result.current.searchQuery).toBe("hello");
    });
  });
});
