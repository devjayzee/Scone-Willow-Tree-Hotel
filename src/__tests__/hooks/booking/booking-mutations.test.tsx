import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockInvalidateWithRelated = vi.fn();
vi.mock("@/lib/query-invalidation", () => ({
  invalidateWithRelated: (...args: unknown[]) =>
    mockInvalidateWithRelated(...args),
}));

const mockCreateBookingApi = vi.fn();
const mockUpdateBookingApi = vi.fn();
const mockDeleteBookingApi = vi.fn();
const mockPerformBookingAction = vi.fn();
vi.mock("@/hooks/booking/booking-api", () => ({
  createBookingApi: (...args: unknown[]) => mockCreateBookingApi(...args),
  updateBookingApi: (...args: unknown[]) => mockUpdateBookingApi(...args),
  deleteBookingApi: (...args: unknown[]) => mockDeleteBookingApi(...args),
  performBookingAction: (...args: unknown[]) =>
    mockPerformBookingAction(...args),
}));

import type { Booking, CreateBookingInput } from "@/types/booking";
import { bookingKeys } from "@/hooks/booking/booking-keys";
import {
  useCreateBooking,
  useDeleteBooking,
} from "@/hooks/booking/booking-mutations";

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    bookingRef: "BK-1",
    roomId: "r-1",
    guestName: "Guest",
    guestPhone: "0400000000",
    checkIn: "2026-05-01",
    checkOut: "2026-05-05",
    status: "CONFIRMED",
    isPaid: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    room: {
      id: "r-1",
      roomNumber: "101",
      capacity: 2,
      pricePerNight: "100",
    },
    ...overrides,
  };
}

const createInput: CreateBookingInput = {
  roomId: "r-1",
  guestName: "New Guest",
  guestEmail: "new@example.com",
  guestPhone: "0400111222",
  checkIn: "2026-06-01",
  checkOut: "2026-06-05",
};

describe("booking mutation hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useCreateBooking", () => {
    it("prepends an optimistic booking with a temp id and BK-PENDING ref", async () => {
      const existing = makeBooking({ id: "existing" });
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), [existing]);

      mockCreateBookingApi.mockResolvedValue(makeBooking({ id: "server-1" }));

      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      const promise = result.current.mutateAsync(createInput);

      await waitFor(() => {
        const cache = queryClient.getQueryData<Booking[]>(bookingKeys.list());
        expect(cache?.length).toBe(2);
        expect(cache?.[0].id).toMatch(/^temp-/);
        expect(cache?.[0].bookingRef).toMatch(/^BK-PENDING-/);
        expect(cache?.[0].guestName).toBe("New Guest");
        expect(cache?.[1]).toEqual(existing);
      });

      await promise;

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Booking created successfully"
        );
      });
      expect(mockInvalidateWithRelated).toHaveBeenCalledWith(
        queryClient,
        "bookings"
      );
    });

    it("rolls back the optimistic booking on error", async () => {
      const snapshot = [makeBooking({ id: "snap" })];
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), snapshot);

      mockCreateBookingApi.mockRejectedValue(new Error("create failed"));

      const { result } = renderHook(() => useCreateBooking(), { wrapper });

      await expect(result.current.mutateAsync(createInput)).rejects.toThrow(
        "create failed"
      );

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("create failed");
      });
      expect(
        queryClient.getQueryData<Booking[]>(bookingKeys.list())
      ).toEqual(snapshot);
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe("useDeleteBooking", () => {
    it("removes the booking from the cache optimistically and toasts on success", async () => {
      const keep = makeBooking({ id: "keep" });
      const drop = makeBooking({ id: "drop" });
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), [keep, drop]);

      mockDeleteBookingApi.mockResolvedValue({
        deleted: true,
        message: "ok",
      });

      const { result } = renderHook(() => useDeleteBooking(), { wrapper });

      const promise = result.current.mutateAsync("drop");

      await waitFor(() => {
        expect(
          queryClient.getQueryData<Booking[]>(bookingKeys.list())
        ).toEqual([keep]);
      });

      await promise;

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Booking deleted successfully"
        );
      });
      expect(mockInvalidateWithRelated).toHaveBeenCalledWith(
        queryClient,
        "bookings"
      );
    });

    it("rolls back to the original list on error", async () => {
      const snapshot = [
        makeBooking({ id: "keep" }),
        makeBooking({ id: "drop" }),
      ];
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), snapshot);

      mockDeleteBookingApi.mockRejectedValue(new Error("delete failed"));

      const { result } = renderHook(() => useDeleteBooking(), { wrapper });

      await expect(result.current.mutateAsync("drop")).rejects.toThrow(
        "delete failed"
      );

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("delete failed");
      });
      expect(
        queryClient.getQueryData<Booking[]>(bookingKeys.list())
      ).toEqual(snapshot);
    });
  });
});
