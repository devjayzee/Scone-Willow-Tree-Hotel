import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetServerSession = vi.fn();
const mockGetDashboardStats = vi.fn();
const mockGetOccupancyReport = vi.fn();
const mockGetRevenueReport = vi.fn();
const mockGetBookingTrends = vi.fn();
const mockGetRoomPerformance = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/report-service", () => ({
  getDashboardStats: (...args: unknown[]) => mockGetDashboardStats(...args),
  getOccupancyReport: (...args: unknown[]) => mockGetOccupancyReport(...args),
  getRevenueReport: (...args: unknown[]) => mockGetRevenueReport(...args),
  getBookingTrends: (...args: unknown[]) => mockGetBookingTrends(...args),
  getRoomPerformance: (...args: unknown[]) => mockGetRoomPerformance(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "@/app/api/reports/route";

describe("Reports API", () => {
  const mockStaffSession = {
    user: { id: "user-1", email: "staff@example.com", role: "STAFF" },
  };
  const mockManagerSession = {
    user: { id: "user-2", email: "manager@example.com", role: "MANAGER" },
  };
  const mockGeneralManagerSession = {
    user: { id: "user-3", email: "gm@example.com", role: "GENERAL_MANAGER" },
  };

  const buildRequest = (search = "") =>
    new Request(`http://localhost/api/reports${search}`);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/reports", () => {
    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await GET(buildRequest());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
      expect(mockGetDashboardStats).not.toHaveBeenCalled();
    });

    it("returns 403 when authenticated user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(mockStaffSession);

      const response = await GET(buildRequest("?type=revenue"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockGetRevenueReport).not.toHaveBeenCalled();
    });

    it("returns dashboard stats for MANAGER (default type)", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      const stats = { totalBookings: 5 };
      mockGetDashboardStats.mockResolvedValue(stats);

      const response = await GET(buildRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(stats);
      expect(mockGetDashboardStats).toHaveBeenCalledTimes(1);
    });

    it("returns revenue report for GENERAL_MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(mockGeneralManagerSession);
      const revenue = { total: "1000.00" };
      mockGetRevenueReport.mockResolvedValue(revenue);

      const response = await GET(buildRequest("?type=revenue"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(revenue);
      expect(mockGetRevenueReport).toHaveBeenCalledTimes(1);
    });

    it("returns occupancy report for MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      mockGetOccupancyReport.mockResolvedValue({ rate: 0.8 });

      const response = await GET(buildRequest("?type=occupancy"));

      expect(response.status).toBe(200);
      expect(mockGetOccupancyReport).toHaveBeenCalledTimes(1);
    });

    it("returns booking trends for MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      mockGetBookingTrends.mockResolvedValue([]);

      const response = await GET(buildRequest("?type=bookings"));

      expect(response.status).toBe(200);
      expect(mockGetBookingTrends).toHaveBeenCalledTimes(1);
    });

    it("passes parsed start/end dates to room performance report", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      mockGetRoomPerformance.mockResolvedValue([]);

      const response = await GET(
        buildRequest("?type=rooms&startDate=2026-01-01&endDate=2026-01-31"),
      );

      expect(response.status).toBe(200);
      expect(mockGetRoomPerformance).toHaveBeenCalledWith(
        new Date("2026-01-01"),
        new Date("2026-01-31"),
      );
    });

    it("returns 400 for an invalid report type", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);

      const response = await GET(buildRequest("?type=bogus"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("handles service errors", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      mockGetDashboardStats.mockRejectedValue(new Error("Database error"));

      const response = await GET(buildRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });
  });
});
