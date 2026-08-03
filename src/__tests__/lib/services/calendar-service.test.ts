import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingStatus } from "@prisma/client";

// Mock Prisma client
const mockBookingFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
    },
  },
}));

// Import after mocks are set up
import { getCalendarEvents } from "@/lib/services/calendar-service";

// Helper to create mock booking data
function createMockBooking(
  overrides: Partial<{
    id: string;
    bookingRef: string;
    guestName: string;
    guestPhone: string | null;
    checkIn: Date;
    checkOut: Date;
    status: BookingStatus;
    roomId: string;
    room: { id: string; roomNumber: string };
  }> = {}
) {
  return {
    id: overrides.id ?? "booking-1",
    bookingRef: overrides.bookingRef ?? "BK-001",
    guestName: overrides.guestName ?? "John Doe",
    guestPhone: overrides.guestPhone ?? "0412345678",
    checkIn: overrides.checkIn ?? new Date("2024-03-01T14:00:00Z"),
    checkOut: overrides.checkOut ?? new Date("2024-03-05T10:00:00Z"),
    status: overrides.status ?? BookingStatus.CONFIRMED,
    roomId: overrides.roomId ?? "room-1",
    room: overrides.room ?? { id: "room-1", roomNumber: "101" },
  };
}

describe("Calendar Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // getCalendarEvents
  // ============================================================
  describe("getCalendarEvents", () => {
    it("should return formatted calendar events for each night of stay", async () => {
      // Booking from March 1 to March 3 (2 nights)
      const mockBookings = [
        createMockBooking({
          id: "booking-1",
          bookingRef: "BK-001",
          guestName: "John Doe",
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-03T10:00:00Z"), // 2 nights
          room: { id: "room-1", roomNumber: "101" },
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      // Should create 2 events (one for each night)
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("title", "Room 101 - John Doe");
      expect(result[0]).toHaveProperty("start");
      expect(result[0]).toHaveProperty("end");
      expect(result[0]).toHaveProperty("resource");
    });

    it("should include correct resource data", async () => {
      const mockBookings = [
        createMockBooking({
          bookingRef: "BK-123",
          guestName: "Jane Smith",
          guestPhone: "0400111222",
          status: BookingStatus.CHECKED_IN,
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-02T10:00:00Z"), // 1 night
          room: { id: "room-2", roomNumber: "202" },
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      expect(result[0].resource).toEqual({
        bookingRef: "BK-123",
        guestName: "Jane Smith",
        guestPhone: "0400111222",
        roomNumber: "202",
        roomId: "room-2",
        status: BookingStatus.CHECKED_IN,
      });
    });

    it("should create event IDs with booking ID and date", async () => {
      const mockBookings = [
        createMockBooking({
          id: "booking-123",
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-02T10:00:00Z"), // 1 night
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      // Event ID should contain booking ID and date
      expect(result[0].id).toContain("booking-123");
      expect(result[0].id).toContain("2024-03-01");
    });

    it("should return ISO string dates", async () => {
      const mockBookings = [
        createMockBooking({
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-02T10:00:00Z"),
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      // Should be valid ISO strings
      expect(() => new Date(result[0].start)).not.toThrow();
      expect(() => new Date(result[0].end)).not.toThrow();
      expect(result[0].start).toContain("T");
      expect(result[0].end).toContain("T");
    });

    it("should return empty array when no bookings exist", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const result = await getCalendarEvents();

      expect(result).toEqual([]);
    });

    it("should filter by start date when provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const startDate = new Date("2024-03-01T00:00:00Z");
      await getCalendarEvents(startDate);

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkIn: { gte: startDate },
          }),
        })
      );
    });

    it("should filter by end date when provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const endDate = new Date("2024-03-31T23:59:59Z");
      await getCalendarEvents(undefined, endDate);

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkOut: { lte: endDate },
          }),
        })
      );
    });

    it("should filter by date range when both dates provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const startDate = new Date("2024-03-01T00:00:00Z");
      const endDate = new Date("2024-03-31T23:59:59Z");
      await getCalendarEvents(startDate, endDate);

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkIn: { gte: startDate },
            checkOut: { lte: endDate },
          }),
        })
      );
    });

    it("should filter by room ID when provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getCalendarEvents(undefined, undefined, "room-123");

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roomId: "room-123",
          }),
        })
      );
    });

    it("should not filter by room when roomId is 'all'", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getCalendarEvents(undefined, undefined, "all");

      const call = mockBookingFindMany.mock.calls[0][0];
      expect(call.where.roomId).toBeUndefined();
    });

    it("should not filter by room when roomId is undefined", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getCalendarEvents();

      const call = mockBookingFindMany.mock.calls[0][0];
      expect(call.where.roomId).toBeUndefined();
    });

    it("should only include CONFIRMED and CHECKED_IN bookings", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getCalendarEvents();

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
            },
          }),
        })
      );
    });

    it("should order bookings by check-in date ascending", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getCalendarEvents();

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { checkIn: "asc" },
        })
      );
    });

    it("should include room data in query", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      await getCalendarEvents();

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            room: {
              select: {
                id: true,
                roomNumber: true,
              },
            },
          },
        })
      );
    });

    it("should format title as 'Room {number} - {guestName}'", async () => {
      const mockBookings = [
        createMockBooking({
          guestName: "Alice Johnson",
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-02T10:00:00Z"),
          room: { id: "room-1", roomNumber: "305" },
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      expect(result[0].title).toBe("Room 305 - Alice Johnson");
    });

    it("should handle multiple bookings with multiple nights", async () => {
      const mockBookings = [
        createMockBooking({
          id: "booking-1",
          guestName: "Guest One",
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-02T10:00:00Z"), // 1 night
          room: { id: "room-1", roomNumber: "101" },
        }),
        createMockBooking({
          id: "booking-2",
          guestName: "Guest Two",
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-03T10:00:00Z"), // 2 nights
          room: { id: "room-2", roomNumber: "102" },
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      // 1 event for booking 1, 2 events for booking 2 = 3 total
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe("Room 101 - Guest One");
      expect(result[1].title).toBe("Room 102 - Guest Two");
      expect(result[2].title).toBe("Room 102 - Guest Two");
    });

    it("should apply all filters together", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const startDate = new Date("2024-03-01T00:00:00Z");
      const endDate = new Date("2024-03-31T23:59:59Z");
      const roomId = "room-specific";

      await getCalendarEvents(startDate, endDate, roomId);

      expect(mockBookingFindMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
          },
          checkIn: { gte: startDate },
          checkOut: { lte: endDate },
          roomId: "room-specific",
        },
        include: {
          room: {
            select: {
              id: true,
              roomNumber: true,
            },
          },
        },
        orderBy: { checkIn: "asc" },
      });
    });
  });
});
