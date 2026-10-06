import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockUseAvailableRooms = vi.fn();
const mockDownloadDraftBookingPDF = vi.fn();

vi.mock("@/hooks/room", () => ({
  useAvailableRooms: (...args: unknown[]) => mockUseAvailableRooms(...args),
}));

vi.mock("@/lib/utils/pdf/booking-registration/index", () => ({
  downloadDraftBookingPDF: (...args: unknown[]) =>
    mockDownloadDraftBookingPDF(...args),
}));

import type { Booking, CreateBookingInput } from "@/types/booking";
import type { RoomSummary } from "@/types/room";
import { useBookingForm } from "@/hooks/use-booking-form";

const rooms: RoomSummary[] = [
  { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "120", description: null },
];

const existingBooking: Booking = {
  id: "b-1",
  bookingRef: "BK-20260501-001",
  roomId: "r-1",
  guestName: "Jane Doe",
  guestDateOfBirth: "1990-01-15",
  guestAddress: "123 Main St",
  guestEmail: "jane@example.com",
  guestPhone: "0412345678",
  vehicleRego: "ABC123",
  additionalGuests: null,
  checkIn: "2026-05-01",
  checkInTime: "14:00",
  checkOut: "2026-05-03",
  checkOutTime: "10:00",
  bondDeposit: "200",
  ratePerNight: "120",
  status: "CONFIRMED",
  isPaid: false,
  notes: "VIP guest",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
  room: { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "120" },
};

function setup(overrides: {
  open?: boolean;
  initialBooking?: Booking | null;
  onSubmit?: (data: CreateBookingInput) => Promise<void>;
  onClose?: () => void;
} = {}) {
  mockUseAvailableRooms.mockReturnValue({ data: rooms, isLoading: false });
  const onSubmit = overrides.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onClose = overrides.onClose ?? vi.fn();

  const utils = renderHook(
    (props: { open: boolean; initialBooking?: Booking | null }) =>
      useBookingForm({
        open: props.open,
        rooms,
        onSubmit,
        onClose,
        initialBooking: props.initialBooking,
      }),
    {
      initialProps: {
        open: overrides.open ?? true,
        initialBooking: overrides.initialBooking ?? null,
      },
    },
  );

  return { ...utils, onSubmit, onClose };
}

describe("useBookingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("opening for a new booking", () => {
    it("seeds today/tomorrow as check-in/check-out dates", async () => {
      const { result } = setup({ open: true, initialBooking: null });

      await waitFor(() => {
        expect(result.current.stay.checkIn).not.toBe("");
      });

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      expect(result.current.stay.checkIn).toBe(fmt(today));
      expect(result.current.stay.checkOut).toBe(fmt(tomorrow));
      expect(result.current.isEditMode).toBe(false);
    });
  });

  describe("opening in edit mode", () => {
    it("hydrates guest and stay state from the existing booking", async () => {
      const { result } = setup({ open: true, initialBooking: existingBooking });

      await waitFor(() => {
        expect(result.current.guest.guestName).toBe("Jane Doe");
      });

      expect(result.current.isEditMode).toBe(true);
      expect(result.current.guest.guestPhone).toBe("0412345678");
      expect(result.current.guest.guestAddress).toBe("123 Main St");
      expect(result.current.stay.roomId).toBe("r-1");
      expect(result.current.stay.checkIn).toBe("2026-05-01");
      expect(result.current.stay.checkOut).toBe("2026-05-03");
      expect(result.current.stay.notes).toBe("VIP guest");
    });
  });

  describe("closing the dialog", () => {
    it("resets the step and form state when open flips to false", async () => {
      const { result, rerender } = setup({ open: true, initialBooking: existingBooking });

      await waitFor(() => {
        expect(result.current.guest.guestName).toBe("Jane Doe");
      });

      act(() => result.current.setStep("stay"));
      expect(result.current.step).toBe("stay");

      rerender({ open: false, initialBooking: existingBooking });

      expect(result.current.step).toBe("guest");
      expect(result.current.guest.guestName).toBe("");
    });
  });

  describe("field setters", () => {
    it("update the corresponding guest/stay field", () => {
      const { result } = setup();

      act(() => result.current.setGuestName("Alice"));
      expect(result.current.guest.guestName).toBe("Alice");

      act(() => result.current.setRoomId("r-1"));
      expect(result.current.stay.roomId).toBe("r-1");

      act(() => result.current.setBondDeposit("50"));
      expect(result.current.stay.bondDeposit).toBe("50");
    });
  });

  describe("derived values", () => {
    it("computes price/nights/total from the selected room and dates", () => {
      const { result } = setup();

      act(() => result.current.handleCheckInChange("2026-06-01"));
      act(() => result.current.handleCheckOutChange("2026-06-04"));
      act(() => result.current.setRoomId("r-1"));

      expect(result.current.selectedRoom).toEqual(rooms[0]);
      expect(result.current.pricePerNight).toBe(120);
      expect(result.current.nights).toBe(3);
      expect(result.current.totalPrice).toBe(360);
    });

    it("canProceedToStay requires guest name and phone", () => {
      const { result } = setup();

      expect(result.current.canProceedToStay).toBe(false);

      act(() => result.current.setGuestName("Alice"));
      act(() => result.current.setGuestPhone("0400000000"));

      expect(result.current.canProceedToStay).toBe(true);
    });
  });

  describe("handleSubmit", () => {
    it("submits the mapped payload and closes on success", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      const { result } = setup({ onSubmit, onClose });

      act(() => result.current.setGuestName("Alice"));
      act(() => result.current.setGuestPhone("0400000000"));
      act(() => result.current.handleCheckInChange("2026-06-01"));
      act(() => result.current.handleCheckOutChange("2026-06-04"));
      act(() => result.current.setRoomId("r-1"));

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          guestName: "Alice",
          guestPhone: "0400000000",
          roomId: "r-1",
          checkIn: "2026-06-01",
          checkOut: "2026-06-04",
        }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBe("");
      expect(result.current.isLoading).toBe(false);
    });

    it("sets an error and does not close when onSubmit rejects", async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error("Room unavailable"));
      const onClose = vi.fn();
      const { result } = setup({ onSubmit, onClose });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.error).toBe("Room unavailable");
      expect(onClose).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it("falls back to a generic error message for a non-Error rejection", async () => {
      const onSubmit = vi.fn().mockRejectedValue("plain string failure");
      const { result } = setup({ onSubmit });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.error).toBe("An error occurred");
    });
  });

  describe("generatePDF", () => {
    it("downloads a draft PDF using the current form state", () => {
      const { result } = setup();

      act(() => result.current.setGuestName("Alice"));
      act(() => result.current.setRoomId("r-1"));

      act(() => result.current.generatePDF());

      expect(mockDownloadDraftBookingPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          guestName: "Alice",
          roomNumber: "101",
          pricePerNight: 120,
        }),
        "Alice",
      );
    });

    it("falls back to 'form' as the filename guest name when empty", () => {
      const { result } = setup();

      act(() => result.current.generatePDF());

      expect(mockDownloadDraftBookingPDF).toHaveBeenCalledWith(
        expect.anything(),
        "form",
      );
    });
  });
});
