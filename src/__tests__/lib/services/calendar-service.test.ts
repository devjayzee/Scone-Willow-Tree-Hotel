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
    guestEmail: string;
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
    guestEmail: overrides.guestEmail ?? "john@example.com",
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
    it("should return formatted calendar events", async () => {
      const mockBookings = [
        createMockBooking({
          id: "booking-1",
          bookingRef: "BK-001",
          guestName: "John Doe",
          guestEmail: "john@example.com",
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-05T10:00:00Z"),
          status: BookingStatus.CONFIRMED,
          room: { id: "room-1", roomNumber: "101" },
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("id", "booking-1");
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
          guestEmail: "jane@example.com",
          status: BookingStatus.CHECKED_IN,
          room: { id: "room-2", roomNumber: "202" },
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      expect(result[0].resource).toEqual({
        bookingRef: "BK-123",
        guestName: "Jane Smith",
        guestEmail: "jane@example.com",
        roomNumber: "202",
        roomId: "room-2",
        status: BookingStatus.CHECKED_IN,
      });
    });

    it("should subtract one day from checkout for display end date", async () => {
      const mockBookings = [
        createMockBooking({
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-05T10:00:00Z"), // March 5
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      // End date should be March 4 (one day before checkout)
      const endDate = new Date(result[0].end);
      expect(endDate.getDate()).toBe(4);
    });

    it("should return ISO string dates", async () => {
      const mockBookings = [
        createMockBooking({
          checkIn: new Date("2024-03-01T14:00:00Z"),
          checkOut: new Date("2024-03-05T10:00:00Z"),
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

      const startDate = "2024-03-01T00:00:00Z";
      await getCalendarEvents(startDate);

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkIn: { gte: new Date(startDate) },
          }),
        })
      );
    });

    it("should filter by end date when provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const endDate = "2024-03-31T23:59:59Z";
      await getCalendarEvents(undefined, endDate);

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkOut: { lte: new Date(endDate) },
          }),
        })
      );
    });

    it("should filter by date range when both dates provided", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const startDate = "2024-03-01T00:00:00Z";
      const endDate = "2024-03-31T23:59:59Z";
      await getCalendarEvents(startDate, endDate);

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            checkIn: { gte: new Date(startDate) },
            checkOut: { lte: new Date(endDate) },
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
          room: { id: "room-1", roomNumber: "305" },
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      expect(result[0].title).toBe("Room 305 - Alice Johnson");
    });

    it("should handle multiple bookings", async () => {
      const mockBookings = [
        createMockBooking({
          id: "booking-1",
          guestName: "Guest One",
          room: { id: "room-1", roomNumber: "101" },
        }),
        createMockBooking({
          id: "booking-2",
          guestName: "Guest Two",
          room: { id: "room-2", roomNumber: "102" },
        }),
        createMockBooking({
          id: "booking-3",
          guestName: "Guest Three",
          room: { id: "room-3", roomNumber: "103" },
        }),
      ];
      mockBookingFindMany.mockResolvedValue(mockBookings);

      const result = await getCalendarEvents();

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe("Room 101 - Guest One");
      expect(result[1].title).toBe("Room 102 - Guest Two");
      expect(result[2].title).toBe("Room 103 - Guest Three");
    });

    it("should apply all filters together", async () => {
      mockBookingFindMany.mockResolvedValue([]);

      const startDate = "2024-03-01T00:00:00Z";
      const endDate = "2024-03-31T23:59:59Z";
      const roomId = "room-specific";

      await getCalendarEvents(startDate, endDate, roomId);

      expect(mockBookingFindMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
          },
          checkIn: { gte: new Date(startDate) },
          checkOut: { lte: new Date(endDate) },
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
