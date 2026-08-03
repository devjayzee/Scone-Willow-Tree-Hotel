import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useDashboardStats,
  useOccupancyReport,
  useRevenueReport,
  useBookingTrends,
  useRoomPerformance,
} from "@/hooks/use-reports";

const mockFetch = vi.fn();

function respondWith<T>(data: T) {
  return { ok: true, json: async () => data };
}

describe("report hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("useDashboardStats hits /api/reports?type=dashboard", async () => {
    const stats = {
      todayCheckIns: 3,
      todayCheckOuts: 2,
      currentOccupancy: 5,
      pendingBookings: 1,
      totalRooms: 10,
      occupancyRate: 50,
      recentBookings: [],
    };
    mockFetch.mockResolvedValue(respondWith(stats));

    const { result } = renderHook(() => useDashboardStats(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(stats);
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/reports?type=dashboard");
  });

  it("useOccupancyReport hits /api/reports?type=occupancy", async () => {
    const data = [{ month: "May 2026", occupancy: 42, bookedDays: 130, totalDays: 310 }];
    mockFetch.mockResolvedValue(respondWith(data));

    const { result } = renderHook(() => useOccupancyReport(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(data);
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/reports?type=occupancy");
  });

  it("useRevenueReport hits /api/reports?type=revenue", async () => {
    const data = [{ month: "May 2026", revenue: 12500 }];
    mockFetch.mockResolvedValue(respondWith(data));

    const { result } = renderHook(() => useRevenueReport(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(data);
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/reports?type=revenue");
  });

  it("useBookingTrends hits /api/reports?type=bookings", async () => {
    const data = [{ date: "May 01", bookings: 3 }];
    mockFetch.mockResolvedValue(respondWith(data));

    const { result } = renderHook(() => useBookingTrends(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(data);
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/reports?type=bookings");
  });

  it("useRoomPerformance without dates hits /api/reports?type=rooms", async () => {
    const data = [
      {
        id: "r-1",
        roomNumber: "101",
        pricePerNight: 100,
        totalBookings: 2,
        totalNights: 6,
        totalRevenue: 600,
      },
    ];
    mockFetch.mockResolvedValue(respondWith(data));

    const { result } = renderHook(() => useRoomPerformance(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(data);
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/reports?type=rooms");
  });

  it("useRoomPerformance appends startDate + endDate params when supplied", async () => {
    mockFetch.mockResolvedValue(respondWith([]));

    renderHook(
      () => useRoomPerformance(undefined, "2026-05-01", "2026-05-31"),
      { wrapper }
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/reports?type=rooms&startDate=2026-05-01&endDate=2026-05-31"
      );
    });
  });
});
