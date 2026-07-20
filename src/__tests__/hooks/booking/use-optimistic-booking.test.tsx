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

import type { Booking } from "@/types/booking";
import { bookingKeys } from "@/hooks/booking/booking-keys";
import {
  addBookingToCache,
  prepareOptimisticUpdate,
  removeBookingFromCache,
  rollbackBookings,
  updateBookingInCache,
  useOptimisticBookingMutation,
} from "@/hooks/booking/use-optimistic-booking";

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

describe("use-optimistic-booking cache helpers", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  describe("updateBookingInCache", () => {
    it("updates the matching booking and leaves others untouched", () => {
      const a = makeBooking({ id: "a" });
      const b = makeBooking({ id: "b", guestName: "Original" });
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), [a, b]);

      updateBookingInCache(queryClient, "b", (booking) => ({
        ...booking,
        guestName: "Updated",
      }));

      const cache = queryClient.getQueryData<Booking[]>(bookingKeys.list());
      expect(cache?.[0]).toEqual(a);
      expect(cache?.[1].guestName).toBe("Updated");
    });

    it("is a no-op when the cache is empty", () => {
      updateBookingInCache(queryClient, "missing", (b) => b);
      expect(
        queryClient.getQueryData<Booking[]>(bookingKeys.list())
      ).toBeUndefined();
    });
  });

  describe("removeBookingFromCache", () => {
    it("removes the matching booking", () => {
      const a = makeBooking({ id: "a" });
      const b = makeBooking({ id: "b" });
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), [a, b]);

      removeBookingFromCache(queryClient, "a");

      expect(
        queryClient.getQueryData<Booking[]>(bookingKeys.list())
      ).toEqual([b]);
    });

    it("is a no-op when the cache is empty", () => {
      removeBookingFromCache(queryClient, "missing");
      expect(
        queryClient.getQueryData<Booking[]>(bookingKeys.list())
      ).toBeUndefined();
    });
  });

  describe("addBookingToCache", () => {
    it("prepends to an existing list", () => {
      const existing = makeBooking({ id: "existing" });
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), [existing]);

      const fresh = makeBooking({ id: "fresh" });
      addBookingToCache(queryClient, fresh);

      const cache = queryClient.getQueryData<Booking[]>(bookingKeys.list());
      expect(cache?.map((b) => b.id)).toEqual(["fresh", "existing"]);
    });

    it("seeds a new list when the cache is empty", () => {
      const fresh = makeBooking({ id: "fresh" });
      addBookingToCache(queryClient, fresh);

      expect(
        queryClient.getQueryData<Booking[]>(bookingKeys.list())
      ).toEqual([fresh]);
    });
  });

  describe("rollbackBookings", () => {
    it("restores the previous snapshot", () => {
      const snapshot = [makeBooking({ id: "snap" })];
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), [
        makeBooking({ id: "current" }),
      ]);

      rollbackBookings(queryClient, { previousBookings: snapshot });

      expect(
        queryClient.getQueryData<Booking[]>(bookingKeys.list())
      ).toEqual(snapshot);
    });

    it("is a no-op when the context has no previousBookings", () => {
      const current = [makeBooking({ id: "current" })];
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), current);

      rollbackBookings(queryClient, { previousBookings: undefined });

      expect(
        queryClient.getQueryData<Booking[]>(bookingKeys.list())
      ).toEqual(current);
    });
  });

  describe("prepareOptimisticUpdate", () => {
    it("returns a snapshot of the current bookings list", async () => {
      const seeded = [makeBooking({ id: "seed" })];
      queryClient.setQueryData<Booking[]>(bookingKeys.list(), seeded);

      const context = await prepareOptimisticUpdate(queryClient);

      expect(context.previousBookings).toEqual(seeded);
    });
  });
});

describe("useOptimisticBookingMutation factory", () => {
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

  it("fires the success toast and invalidates on resolve", async () => {
    const initial = [makeBooking({ id: "init" })];
    queryClient.setQueryData<Booking[]>(bookingKeys.list(), initial);

    const { result } = renderHook(
      () =>
        useOptimisticBookingMutation<string, Booking>({
          mutationFn: async () => makeBooking({ id: "resolved" }),
          onMutateOptimistic: () => {},
          successMessage: "Nice",
        }),
      { wrapper }
    );

    await result.current.mutateAsync("x");

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Nice");
    });
    expect(mockInvalidateWithRelated).toHaveBeenCalledWith(
      queryClient,
      "bookings"
    );
  });

  it("resolves the successMessage function against the mutation data", async () => {
    const { result } = renderHook(
      () =>
        useOptimisticBookingMutation<string, Booking>({
          mutationFn: async () => makeBooking({ id: "paid", isPaid: true }),
          onMutateOptimistic: () => {},
          successMessage: (data) => (data.isPaid ? "Paid" : "Unpaid"),
        }),
      { wrapper }
    );

    await result.current.mutateAsync("x");

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Paid");
    });
  });

  it("rolls back the cache and fires the error toast on reject", async () => {
    const snapshot = [makeBooking({ id: "snap" })];
    queryClient.setQueryData<Booking[]>(bookingKeys.list(), snapshot);

    const { result } = renderHook(
      () =>
        useOptimisticBookingMutation<string, Booking>({
          mutationFn: async () => {
            throw new Error("boom");
          },
          onMutateOptimistic: (_v, qc) => {
            qc.setQueryData<Booking[]>(bookingKeys.list(), [
              makeBooking({ id: "optimistic" }),
            ]);
          },
          successMessage: "Nope",
        }),
      { wrapper }
    );

    await expect(result.current.mutateAsync("x")).rejects.toThrow("boom");

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("boom");
    });
    expect(
      queryClient.getQueryData<Booking[]>(bookingKeys.list())
    ).toEqual(snapshot);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockInvalidateWithRelated).toHaveBeenCalledWith(
      queryClient,
      "bookings"
    );
  });
});
