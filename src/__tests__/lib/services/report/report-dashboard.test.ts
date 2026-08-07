import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setupMocks,
  createMockBooking,
  resetMocks,
  mockBookingCount,
  mockBookingFindMany,
  mockRoomCount,
} from "./test-utils";

// Setup mocks before importing services
setupMocks();

// Import after mocks are set up
import { getDashboardStats } from "@/lib/services/report";

describe("Report Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ============================================================
  // getDashboardStats
  // ============================================================
  describe("getDashboardStats", () => {
    it("should return correct dashboard statistics", async () => {
      // Mock all the concurrent queries
      mockBookingCount
        .mockResolvedValueOnce(3) // todayCheckIns
        .mockResolvedValueOnce(2) // todayCheckOuts
        .mockResolvedValueOnce(5) // currentOccupancy
        .mockResolvedValueOnce(4); // pendingBookings

      mockBookingFindMany.mockResolvedValue([
        createMockBooking({
          id: "booking-1",
          bookingRef: "BK-001",
          guestName: "John Doe",
          guestEmail: "john@example.com",
        }),
      ]);

      mockRoomCount.mockResolvedValue(10);

      const result = await getDashboardStats();

      expect(result.todayCheckIns).toBe(3);
      expect(result.todayCheckOuts).toBe(2);
      expect(result.currentOccupancy).toBe(5);
      expect(result.pendingBookings).toBe(4);
      expect(result.totalRooms).toBe(10);
      expect(result.occupancyRate).toBe(50); // 5/10 * 100
      expect(result.recentBookings).toHaveLength(1);
    });

    it("should calculate 0% occupancy when no rooms exist", async () => {
      mockBookingCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockBookingFindMany.mockResolvedValue([]);
      mockRoomCount.mockResolvedValue(0);

      const result = await getDashboardStats();

      expect(result.occupancyRate).toBe(0);
      expect(result.totalRooms).toBe(0);
    });

    it("should transform recent bookings to correct format", async () => {
      mockBookingCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const mockBooking = createMockBooking({
        checkIn: new Date("2024-03-01T10:00:00Z"),
        checkOut: new Date("2024-03-05T10:00:00Z"),
        createdAt: new Date("2024-02-15T10:00:00Z"),
      });
      mockBookingFindMany.mockResolvedValue([mockBooking]);
      mockRoomCount.mockResolvedValue(10);

      const result = await getDashboardStats();

      expect(result.recentBookings[0].checkIn).toBe(
        mockBooking.checkIn.toISOString()
      );
      expect(result.recentBookings[0].checkOut).toBe(
        mockBooking.checkOut.toISOString()
      );
      expect(result.recentBookings[0].createdAt).toBe(
        mockBooking.createdAt.toISOString()
      );
      expect(result.recentBookings[0].room.roomNumber).toBe("101");
    });

    it("should round occupancy rate to nearest integer", async () => {
      mockBookingCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3) // currentOccupancy
        .mockResolvedValueOnce(0);
      mockBookingFindMany.mockResolvedValue([]);
      mockRoomCount.mockResolvedValue(7); // 3/7 = 42.857...

      const result = await getDashboardStats();

      expect(result.occupancyRate).toBe(43); // Rounded
    });
  });
});
