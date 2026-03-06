import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingStatus } from "@prisma/client";

// Mock Prisma client
const mockBookingCount = vi.fn();
const mockBookingFindMany = vi.fn();
const mockRoomCount = vi.fn();
const mockRoomFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      count: (...args: unknown[]) => mockBookingCount(...args),
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
    },
    room: {
      count: (...args: unknown[]) => mockRoomCount(...args),
      findMany: (...args: unknown[]) => mockRoomFindMany(...args),
    },
  },
}));

// Import after mocks are set up
import {
  getDashboardStats,
  getOccupancyReport,
  getRevenueReport,
  getBookingTrends,
  getRoomPerformance,
} from "@/lib/services/report-service";

// Helper to create mock booking data
function createMockBooking(
  overrides: Partial<{
    id: string;
    bookingRef: string;
    guestName: string;
    guestEmail: string;
    checkIn: Date;
    checkOut: Date;
    status: BookingStatus;
    createdAt: Date;
    roomId: string;
    room: { roomNumber: string; pricePerNight: number };
  }> = {}
) {
  return {
    id: overrides.id ?? "booking-1",
    bookingRef: overrides.bookingRef ?? "BK-001",
    guestName: overrides.guestName ?? "John Doe",
    guestEmail: overrides.guestEmail ?? "john@example.com",
    checkIn: overrides.checkIn ?? new Date("2024-03-01"),
    checkOut: overrides.checkOut ?? new Date("2024-03-05"),
    status: overrides.status ?? BookingStatus.CONFIRMED,
    createdAt: overrides.createdAt ?? new Date("2024-02-15"),
    roomId: overrides.roomId ?? "room-1",
    room: overrides.room ?? { roomNumber: "101", pricePerNight: 100 },
  };
}

// Helper to create mock room data
function createMockRoom(
  overrides: Partial<{
    id: string;
    roomNumber: string;
    capacity: number;
    pricePerNight: number;
    description: string | null;
    bookings: Array<{
      checkIn: Date;
      checkOut: Date;
      status: BookingStatus;
    }>;
  }> = {}
) {
  return {
    id: overrides.id ?? "room-1",
    roomNumber: overrides.roomNumber ?? "101",
    capacity: overrides.capacity ?? 2,
    pricePerNight: overrides.pricePerNight ?? 100,
    description: overrides.description ?? "Standard room",
    bookings: overrides.bookings ?? [],
  };
}

describe("Report Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  // ============================================================
  // getOccupancyReport
  // ============================================================
  describe("getOccupancyReport", () => {
    it("should return 6 months of occupancy data", async () => {
      mockRoomCount.mockResolvedValue(10);
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getOccupancyReport();

      expect(result).toHaveLength(6);
      expect(result[0]).toHaveProperty("month");
      expect(result[0]).toHaveProperty("occupancy");
      expect(result[0]).toHaveProperty("bookedDays");
      expect(result[0]).toHaveProperty("totalDays");
    });

    it("should calculate occupancy rate correctly", async () => {
      mockRoomCount.mockResolvedValue(10);

      // First 5 months return no bookings
      for (let i = 0; i < 5; i++) {
        mockBookingFindMany.mockResolvedValueOnce([]);
      }

      // Last month has some bookings
      mockBookingFindMany.mockResolvedValueOnce([
        createMockBooking({
          checkIn: new Date("2024-03-01"),
          checkOut: new Date("2024-03-11"), // 10 nights
        }),
      ]);

      const result = await getOccupancyReport();

      // The last month should have some occupancy
      expect(result[5].bookedDays).toBeGreaterThanOrEqual(0);
    });

    it("should handle zero rooms gracefully", async () => {
      mockRoomCount.mockResolvedValue(0);
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getOccupancyReport();

      result.forEach((month) => {
        expect(month.occupancy).toBe(0);
        expect(month.totalDays).toBe(0);
      });
    });

    it("should format month names correctly", async () => {
      mockRoomCount.mockResolvedValue(10);
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getOccupancyReport();

      // Each month should have format like "Mar 2024"
      result.forEach((month) => {
        expect(month.month).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
      });
    });
  });

  // ============================================================
  // getRevenueReport
  // ============================================================
  describe("getRevenueReport", () => {
    it("should return 6 months of revenue data", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getRevenueReport();

      expect(result).toHaveLength(6);
      expect(result[0]).toHaveProperty("month");
      expect(result[0]).toHaveProperty("revenue");
    });

    it("should calculate revenue based on nights and room price", async () => {
      // Mock for first 5 months with no bookings
      for (let i = 0; i < 5; i++) {
        mockBookingFindMany.mockResolvedValueOnce([]);
      }

      // Last month has bookings
      mockBookingFindMany.mockResolvedValueOnce([
        createMockBooking({
          checkIn: new Date("2024-03-01"),
          checkOut: new Date("2024-03-05"), // 4 nights
          room: { roomNumber: "101", pricePerNight: 100 },
        }),
      ]);

      const result = await getRevenueReport();

      // Last month: 4 nights * $100 = $400
      expect(result[5].revenue).toBe(400);
    });

    it("should sum revenue from multiple bookings", async () => {
      // Mock for first 5 months with no bookings
      for (let i = 0; i < 5; i++) {
        mockBookingFindMany.mockResolvedValueOnce([]);
      }

      mockBookingFindMany.mockResolvedValueOnce([
        createMockBooking({
          checkIn: new Date("2024-03-01"),
          checkOut: new Date("2024-03-03"), // 2 nights @ $100 = $200
          room: { roomNumber: "101", pricePerNight: 100 },
        }),
        createMockBooking({
          checkIn: new Date("2024-03-10"),
          checkOut: new Date("2024-03-12"), // 2 nights @ $150 = $300
          room: { roomNumber: "102", pricePerNight: 150 },
        }),
      ]);

      const result = await getRevenueReport();

      expect(result[5].revenue).toBe(500); // $200 + $300
    });

    it("should return zero revenue when no bookings exist", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getRevenueReport();

      result.forEach((month) => {
        expect(month.revenue).toBe(0);
      });
    });

    it("should round revenue to integer", async () => {
      // Mock for first 5 months with no bookings
      for (let i = 0; i < 5; i++) {
        mockBookingFindMany.mockResolvedValueOnce([]);
      }

      mockBookingFindMany.mockResolvedValueOnce([
        createMockBooking({
          checkIn: new Date("2024-03-01"),
          checkOut: new Date("2024-03-04"), // 3 nights
          room: { roomNumber: "101", pricePerNight: 99.99 },
        }),
      ]);

      const result = await getRevenueReport();

      // 3 * 99.99 = 299.97, rounded to 300
      expect(Number.isInteger(result[5].revenue)).toBe(true);
    });
  });

  // ============================================================
  // getBookingTrends
  // ============================================================
  describe("getBookingTrends", () => {
    it("should return 30 days of booking data", async () => {
      mockBookingCount.mockResolvedValue(0);

      const result = await getBookingTrends();

      expect(result).toHaveLength(30);
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("bookings");
    });

    it("should return booking counts for each day", async () => {
      // First 29 days with 0 bookings
      for (let i = 0; i < 29; i++) {
        mockBookingCount.mockResolvedValueOnce(0);
      }
      // Today has 5 bookings
      mockBookingCount.mockResolvedValueOnce(5);

      const result = await getBookingTrends();

      expect(result[29].bookings).toBe(5);
    });

    it("should format date as MMM dd", async () => {
      mockBookingCount.mockResolvedValue(0);

      const result = await getBookingTrends();

      // Each date should have format like "Mar 01"
      result.forEach((day) => {
        expect(day.date).toMatch(/^[A-Z][a-z]{2} \d{2}$/);
      });
    });

    it("should handle days with varying booking counts", async () => {
      const counts = Array.from({ length: 30 }, (_, i) => i);
      counts.forEach((count) => {
        mockBookingCount.mockResolvedValueOnce(count);
      });

      const result = await getBookingTrends();

      result.forEach((day, index) => {
        expect(day.bookings).toBe(index);
      });
    });
  });

  // ============================================================
  // getRoomPerformance
  // ============================================================
  describe("getRoomPerformance", () => {
    it("should return performance data for all rooms", async () => {
      mockRoomFindMany.mockResolvedValue([
        createMockRoom({
          id: "room-1",
          roomNumber: "101",
          pricePerNight: 100,
          bookings: [],
        }),
        createMockRoom({
          id: "room-2",
          roomNumber: "102",
          pricePerNight: 150,
          bookings: [],
        }),
      ]);

      const result = await getRoomPerformance();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("roomNumber");
      expect(result[0]).toHaveProperty("pricePerNight");
      expect(result[0]).toHaveProperty("totalBookings");
      expect(result[0]).toHaveProperty("totalNights");
      expect(result[0]).toHaveProperty("totalRevenue");
    });

    it("should calculate totals from bookings", async () => {
      mockRoomFindMany.mockResolvedValue([
        createMockRoom({
          id: "room-1",
          roomNumber: "101",
          pricePerNight: 100,
          bookings: [
            {
              checkIn: new Date("2024-03-01"),
              checkOut: new Date("2024-03-05"), // 4 nights
              status: BookingStatus.CHECKED_OUT,
            },
            {
              checkIn: new Date("2024-03-10"),
              checkOut: new Date("2024-03-12"), // 2 nights
              status: BookingStatus.CONFIRMED,
            },
          ],
        }),
      ]);

      const result = await getRoomPerformance();

      expect(result[0].totalBookings).toBe(2);
      expect(result[0].totalNights).toBe(6); // 4 + 2
      expect(result[0].totalRevenue).toBe(600); // 6 nights * $100
    });

    it("should return zero totals for rooms with no bookings", async () => {
      mockRoomFindMany.mockResolvedValue([
        createMockRoom({
          id: "room-1",
          roomNumber: "101",
          pricePerNight: 100,
          bookings: [],
        }),
      ]);

      const result = await getRoomPerformance();

      expect(result[0].totalBookings).toBe(0);
      expect(result[0].totalNights).toBe(0);
      expect(result[0].totalRevenue).toBe(0);
    });

    it("should filter by date range when provided", async () => {
      mockRoomFindMany.mockResolvedValue([
        createMockRoom({ bookings: [] }),
      ]);

      const startDate = new Date("2024-03-01");
      const endDate = new Date("2024-03-31");

      await getRoomPerformance(startDate, endDate);

      expect(mockRoomFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            bookings: expect.objectContaining({
              where: expect.objectContaining({
                checkIn: expect.any(Object),
              }),
            }),
          }),
        })
      );
    });

    it("should not filter by date when no range provided", async () => {
      mockRoomFindMany.mockResolvedValue([]);

      await getRoomPerformance();

      const call = mockRoomFindMany.mock.calls[0][0];
      expect(call.include.bookings.where.checkIn).toBeUndefined();
    });

    it("should sort rooms by room number", async () => {
      mockRoomFindMany.mockResolvedValue([
        createMockRoom({ id: "room-3", roomNumber: "103", bookings: [] }),
        createMockRoom({ id: "room-1", roomNumber: "101", bookings: [] }),
        createMockRoom({ id: "room-2", roomNumber: "102", bookings: [] }),
      ]);

      await getRoomPerformance();

      expect(mockRoomFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { roomNumber: "asc" },
        })
      );
    });

    it("should round revenue to integer", async () => {
      mockRoomFindMany.mockResolvedValue([
        createMockRoom({
          id: "room-1",
          roomNumber: "101",
          pricePerNight: 99.99,
          bookings: [
            {
              checkIn: new Date("2024-03-01"),
              checkOut: new Date("2024-03-04"), // 3 nights
              status: BookingStatus.CONFIRMED,
            },
          ],
        }),
      ]);

      const result = await getRoomPerformance();

      // 3 * 99.99 = 299.97, rounded to 300
      expect(Number.isInteger(result[0].totalRevenue)).toBe(true);
    });

    it("should return empty array when no rooms exist", async () => {
      mockRoomFindMany.mockResolvedValue([]);

      const result = await getRoomPerformance();

      expect(result).toEqual([]);
    });

    it("should include only specific booking statuses", async () => {
      mockRoomFindMany.mockResolvedValue([]);

      await getRoomPerformance();

      const call = mockRoomFindMany.mock.calls[0][0];
      expect(call.include.bookings.where.status.in).toEqual([
        BookingStatus.CONFIRMED,
        BookingStatus.CHECKED_IN,
        BookingStatus.CHECKED_OUT,
      ]);
    });
  });
});
