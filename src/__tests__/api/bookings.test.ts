import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
const mockGetServerSession = vi.fn();
const mockGetAllBookings = vi.fn();
const mockCreateBooking = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/booking", () => ({
  getAllBookings: (...args: unknown[]) => mockGetAllBookings(...args),
  createBooking: (...args: unknown[]) => mockCreateBooking(...args),
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

// Import after mocks
import { GET, POST } from "@/app/api/bookings/route";

describe("Bookings API", () => {
  const mockSession = {
    user: {
      id: "user-1",
      email: "test@example.com",
      role: "STAFF",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // GET /api/bookings
  // ============================================================
  describe("GET /api/bookings", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/bookings");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return bookings when authenticated", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);
      const mockBookings = [
        { id: "booking-1", bookingRef: "BK-001" },
        { id: "booking-2", bookingRef: "BK-002" },
      ];
      mockGetAllBookings.mockResolvedValue(mockBookings);

      const request = new NextRequest("http://localhost/api/bookings");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockBookings);
    });

    it("should pass status filter to service", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);
      mockGetAllBookings.mockResolvedValue([]);

      const request = new NextRequest("http://localhost/api/bookings?status=CONFIRMED");
      await GET(request);

      expect(mockGetAllBookings).toHaveBeenCalledWith(
        expect.objectContaining({ status: "CONFIRMED" })
      );
    });

    it("should pass roomId filter to service", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);
      mockGetAllBookings.mockResolvedValue([]);

      const request = new NextRequest("http://localhost/api/bookings?roomId=room-123");
      await GET(request);

      expect(mockGetAllBookings).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: "room-123" })
      );
    });

    it("should pass date filters to service", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);
      mockGetAllBookings.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost/api/bookings?startDate=2024-03-01&endDate=2024-03-31"
      );
      await GET(request);

      expect(mockGetAllBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });

    it("returns 400 when status is not a known BookingStatus", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const request = new NextRequest(
        "http://localhost/api/bookings?status=BOGUS",
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(mockGetAllBookings).not.toHaveBeenCalled();
    });

    it("returns 400 when startDate is not a parseable date", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const request = new NextRequest(
        "http://localhost/api/bookings?startDate=not-a-date",
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(mockGetAllBookings).not.toHaveBeenCalled();
    });

    it("should handle service errors", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);
      mockGetAllBookings.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost/api/bookings");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });
  });

  // ============================================================
  // POST /api/bookings
  // ============================================================
  describe("POST /api/bookings", () => {
    const validBookingInput = {
      roomId: "room-1",
      guestName: "John Doe",
      guestPhone: "0412345678",
      checkIn: "2024-03-15",
      checkOut: "2024-03-20",
    };

    it("should return 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify(validBookingInput),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should create booking when valid data provided", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);
      const mockCreatedBooking = {
        id: "booking-1",
        bookingRef: "BK-20240315-001",
        ...validBookingInput,
      };
      mockCreateBooking.mockResolvedValue(mockCreatedBooking);

      const request = new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify(validBookingInput),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.bookingRef).toBe("BK-20240315-001");
    });

    it("should return 400 for invalid input", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);

      const invalidInput = {
        roomId: "room-1",
        // Missing required fields
      };

      const request = new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify(invalidInput),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("should pass user ID to createBooking", async () => {
      mockGetServerSession.mockResolvedValue(mockSession);
      mockCreateBooking.mockResolvedValue({ id: "booking-1" });

      const request = new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify(validBookingInput),
      });
      await POST(request);

      expect(mockCreateBooking).toHaveBeenCalledWith(
        expect.any(Object),
        "user-1",
        "user-1"
      );
    });
  });
});
