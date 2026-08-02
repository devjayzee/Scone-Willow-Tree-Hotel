import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockLoggerError = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockFetchBookingById = vi.fn();
vi.mock("@/hooks/booking/booking-api", () => ({
  fetchBookingById: (...args: unknown[]) => mockFetchBookingById(...args),
}));

import type { Booking } from "@/types/booking";
import { bookingKeys } from "@/hooks/booking/booking-keys";
import { useFetchBooking } from "@/hooks/booking/use-fetch-booking";

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
    room: { id: "r-1", roomNumber: "101", capacity: 2, pricePerNight: "100" },
    ...overrides,
  };
}

describe("useFetchBooking", () => {
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

  it("resolves with the fetched booking and populates the detail cache", async () => {
    const booking = makeBooking({ id: "target" });
    mockFetchBookingById.mockResolvedValue(booking);

    const { result } = renderHook(() => useFetchBooking(), { wrapper });
    const resolved = await result.current("target");

    expect(resolved).toEqual(booking);
    expect(mockFetchBookingById).toHaveBeenCalledWith("target");
    expect(queryClient.getQueryData(bookingKeys.detail("target"))).toEqual(booking);
  });

  it("returns null and logs + toasts on fetch error", async () => {
    mockFetchBookingById.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useFetchBooking(), { wrapper });
    const resolved = await result.current("target");

    expect(resolved).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith("Failed to fetch booking details");
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Failed to fetch booking details",
      expect.any(Error),
      { id: "target" }
    );
  });

  it("dedupes repeat calls within the stale window", async () => {
    const booking = makeBooking({ id: "shared" });
    mockFetchBookingById.mockResolvedValue(booking);

    const { result } = renderHook(() => useFetchBooking(), { wrapper });
    await result.current("shared");
    await result.current("shared");

    expect(mockFetchBookingById).toHaveBeenCalledTimes(1);
  });
});
