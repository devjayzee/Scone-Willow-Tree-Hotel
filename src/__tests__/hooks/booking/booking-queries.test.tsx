import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockFetchBookings = vi.fn();
vi.mock("@/hooks/booking/booking-api", () => ({
  fetchBookings: (...args: unknown[]) => mockFetchBookings(...args),
}));

import type { Booking } from "@/types/booking";
import { useBookings } from "@/hooks/booking/booking-queries";

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    bookingRef: "BK-1",
    roomId: "r-1",
    guestName: "Guest",
    guestPhone: "0400000000",
    checkIn: "2026-05-01",
    checkOut: "2026-05-05",
    ratePerNight: "100",
    status: "CONFIRMED",
    isPaid: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    room: { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "100" },
    ...overrides,
  };
}

describe("useBookings", () => {
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

  it("uses initialData without hitting the network", () => {
    const seeded = [makeBooking({ id: "seed" })];

    const { result } = renderHook(() => useBookings(seeded, Date.now()), {
      wrapper,
    });

    expect(result.current.data).toEqual(seeded);
    expect(mockFetchBookings).not.toHaveBeenCalled();
  });

  it("surfaces fetched data through result.current.data", async () => {
    const fetched = [makeBooking({ id: "fetched" })];
    mockFetchBookings.mockResolvedValue(fetched);

    const { result } = renderHook(() => useBookings(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(fetched);
    });
    expect(mockFetchBookings).toHaveBeenCalledTimes(1);
  });
});
