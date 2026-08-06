import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setupMocks,
  createMockBooking,
  resetMocks,
  mockBookingFindMany,
  mockBookingFindUnique,
} from "./test-utils";

// Setup mocks before importing services
setupMocks();

// Import after mocks are set up
import {
  getAllBookings,
  getBookingById,
  getBookingByRef,
  NotFoundError,
} from "@/lib/services/booking";

describe("Booking Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ============================================================
  // getAllBookings
  // ============================================================
  describe("getAllBookings", () => {
    it("should return all bookings ordered by check-in date descending", async () => {
      const mockBookings = [
        createMockBooking({ id: "booking-2", checkIn: new Date("2024-03-15") }),
        createMockBooking({ id: "booking-1", checkIn: new Date("2024-03-10") }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getAllBookings();

      expect(mockBookingFindMany).toHaveBeenCalledOnce();
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no bookings exist", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getAllBookings();

      expect(result).toEqual([]);
    });

    it("should filter by status when provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getAllBookings({ status: "CONFIRMED" });

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "CONFIRMED" }),
        })
      );
    });

    it("should filter by roomId when provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getAllBookings({ roomId: "room-123" });

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ roomId: "room-123" }),
        })
      );
    });

    it("should filter by date range when provided", async () => {
      const startDate = new Date("2024-03-01");
      const endDate = new Date("2024-03-31");
      mockBookingFindMany.mockResolvedValue([]);

      await getAllBookings({ startDate, endDate });

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkIn: { gte: startDate },
            checkOut: { lte: endDate },
          }),
        })
      );
    });

    it("should combine multiple filters", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getAllBookings({
        status: "CHECKED_IN",
        roomId: "room-1",
      });

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "CHECKED_IN",
            roomId: "room-1",
          }),
        })
      );
    });
  });

  // ============================================================
  // getBookingById
  // ============================================================
  describe("getBookingById", () => {
    it("should return booking when found", async () => {
      const mockBooking = createMockBooking({ id: "booking-123" });
      mockBookingFindUnique.mockResolvedValue(mockBooking);

      const result = await getBookingById("booking-123");

      expect(mockBookingFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "booking-123" },
        })
      );
      expect(result).toEqual(mockBooking);
    });

    it("should throw NotFoundError when booking does not exist", async () => {
      mockBookingFindUnique.mockResolvedValue(null);

      await expect(getBookingById("non-existent")).rejects.toThrow(NotFoundError);
      await expect(getBookingById("non-existent")).rejects.toThrow("Booking not found");
    });
  });

  // ============================================================
  // getBookingByRef
  // ============================================================
  describe("getBookingByRef", () => {
    it("should return booking when found by reference", async () => {
      const mockBooking = createMockBooking({ bookingRef: "BK-20240301-001" });
      mockBookingFindUnique.mockResolvedValue(mockBooking);

      const result = await getBookingByRef("BK-20240301-001");

      expect(mockBookingFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingRef: "BK-20240301-001" },
        })
      );
      expect(result).toEqual(mockBooking);
    });

    it("should throw NotFoundError when booking reference does not exist", async () => {
      mockBookingFindUnique.mockResolvedValue(null);

      await expect(getBookingByRef("BK-INVALID")).rejects.toThrow(NotFoundError);
      await expect(getBookingByRef("BK-INVALID")).rejects.toThrow("Booking not found");
    });
  });
});
