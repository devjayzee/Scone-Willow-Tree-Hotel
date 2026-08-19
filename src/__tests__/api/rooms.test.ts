import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
const mockGetServerSession = vi.fn();
const mockGetAllRooms = vi.fn();
const mockCreateRoom = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/room-service", () => ({
  getAllRooms: (...args: unknown[]) => mockGetAllRooms(...args),
  createRoom: (...args: unknown[]) => mockCreateRoom(...args),
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
import { GET, POST } from "@/app/api/rooms/route";

describe("Rooms API", () => {
  const mockStaffSession = {
    user: {
      id: "user-1",
      email: "staff@example.com",
      role: "STAFF",
    },
  };

  const mockManagerSession = {
    user: {
      id: "user-2",
      email: "manager@example.com",
      role: "GENERAL_MANAGER",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // GET /api/rooms
  // ============================================================
  describe("GET /api/rooms", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return rooms when authenticated as GENERAL_MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      const mockRooms = [
        { id: "room-1", roomNumber: "101" },
        { id: "room-2", roomNumber: "102" },
      ];
      mockGetAllRooms.mockResolvedValue(mockRooms);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockRooms);
    });

    it("should return 403 when authenticated as STAFF", async () => {
      // GET /api/rooms tightened to GENERAL_MANAGER — MANAGER/STAFF
      // flows that need room data use GET /api/rooms/available. See
      // plans/fix-rooms-page-gm-only.md.
      mockGetServerSession.mockResolvedValue(mockStaffSession);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockGetAllRooms).not.toHaveBeenCalled();
    });

    it("should return 403 when authenticated as MANAGER", async () => {
      const mockMgrSession = {
        user: {
          id: "user-mgr",
          email: "mgr@example.com",
          role: "MANAGER",
        },
      };
      mockGetServerSession.mockResolvedValue(mockMgrSession);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockGetAllRooms).not.toHaveBeenCalled();
    });

    it("should handle service errors", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      mockGetAllRooms.mockRejectedValue(new Error("Database error"));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });
  });

  // ============================================================
  // POST /api/rooms
  // ============================================================
  describe("POST /api/rooms", () => {
    const validRoomInput = {
      roomNumber: "201",
      capacity: 2,
      pricePerNight: 150,
    };

    it("should return 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify(validRoomInput),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 when user is not GENERAL_MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(mockStaffSession);

      const request = new NextRequest("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify(validRoomInput),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should create room when GENERAL_MANAGER with valid data", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      const mockCreatedRoom = {
        id: "room-1",
        ...validRoomInput,
      };
      mockCreateRoom.mockResolvedValue(mockCreatedRoom);

      const request = new NextRequest("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify(validRoomInput),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.roomNumber).toBe("201");
    });

    it("should return 400 for invalid input", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);

      const invalidInput = {
        // Missing required roomNumber
        capacity: 2,
      };

      const request = new NextRequest("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify(invalidInput),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid capacity", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);

      const invalidInput = {
        roomNumber: "301",
        capacity: 15, // Max is 10
        pricePerNight: 100,
      };

      const request = new NextRequest("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify(invalidInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should handle service errors", async () => {
      mockGetServerSession.mockResolvedValue(mockManagerSession);
      mockCreateRoom.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify(validRoomInput),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });
  });
});
