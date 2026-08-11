import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingStatus } from "@prisma/client";
import {
  setupMocks,
  createMockRoom,
  resetMocks,
  mockRoomFindMany,
} from "./test-utils";

// Setup mocks before importing services
setupMocks();

// Import after mocks are set up
import { getRoomPerformance } from "@/lib/services/report";

describe("Report Analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
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
      expect(result[0]).toHaveProperty("bookedRevenue");
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
              ratePerNight: 100,
              status: BookingStatus.CHECKED_OUT,
            },
            {
              checkIn: new Date("2024-03-10"),
              checkOut: new Date("2024-03-12"), // 2 nights
              ratePerNight: 100,
              status: BookingStatus.CONFIRMED,
            },
          ],
        }),
      ]);

      const result = await getRoomPerformance();

      expect(result[0].totalBookings).toBe(2);
      expect(result[0].totalNights).toBe(6); // 4 + 2
      expect(result[0].bookedRevenue).toBe(600); // 6 nights * $100
    });

    it("bookedRevenue uses booking.ratePerNight (snapshot), not room.pricePerNight (current) — #185", async () => {
      // Room's current price is $200, but the two bookings were
      // snapshotted at $80 and $90 respectively. Total revenue must
      // reflect the snapshots, not the current room price.
      mockRoomFindMany.mockResolvedValue([
        createMockRoom({
          id: "room-1",
          roomNumber: "101",
          pricePerNight: 200,
          bookings: [
            {
              checkIn: new Date("2024-03-01"),
              checkOut: new Date("2024-03-03"), // 2 nights
              ratePerNight: 80,
              status: BookingStatus.CHECKED_OUT,
            },
            {
              checkIn: new Date("2024-03-10"),
              checkOut: new Date("2024-03-13"), // 3 nights
              ratePerNight: 90,
              status: BookingStatus.CONFIRMED,
            },
          ],
        }),
      ]);

      const result = await getRoomPerformance();

      // 2 * 80 + 3 * 90 = 160 + 270 = 430. NOT 5 * 200 = 1000.
      expect(result[0].bookedRevenue).toBe(430);
      // pricePerNight stays as the room's current display anchor.
      expect(result[0].pricePerNight).toBe(200);
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
      expect(result[0].bookedRevenue).toBe(0);
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
              ratePerNight: 99.99,
              status: BookingStatus.CONFIRMED,
            },
          ],
        }),
      ]);

      const result = await getRoomPerformance();

      // 3 * 99.99 = 299.97, rounded to 300
      expect(Number.isInteger(result[0].bookedRevenue)).toBe(true);
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
