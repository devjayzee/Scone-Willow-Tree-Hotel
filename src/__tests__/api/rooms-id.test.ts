import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();
const mockGetRoomById = vi.fn();
const mockUpdateRoom = vi.fn();
const mockDeleteRoom = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/room-service", () => ({
  getRoomById: (...args: unknown[]) => mockGetRoomById(...args),
  updateRoom: (...args: unknown[]) => mockUpdateRoom(...args),
  deleteRoom: (...args: unknown[]) => mockDeleteRoom(...args),
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

import { GET, PUT, DELETE } from "@/app/api/rooms/[id]/route";

const params = Promise.resolve({ id: "room-1" });

describe("Rooms [id] API", () => {
  const staffSession = {
    user: { id: "u-staff", email: "s@example.com", role: "STAFF" },
  };
  const managerSession = {
    user: { id: "u-mgr", email: "m@example.com", role: "MANAGER" },
  };
  const gmSession = {
    user: { id: "u-gm", email: "gm@example.com", role: "GENERAL_MANAGER" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/rooms/[id]", () => {
    const req = new Request("http://localhost/api/rooms/room-1");

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await GET(req, { params });

      expect(response.status).toBe(401);
      expect(mockGetRoomById).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF (GM-only endpoint)", async () => {
      // GET /api/rooms/[id] tightened to GENERAL_MANAGER — see
      // plans/fix-rooms-page-gm-only.md.
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockGetRoomById).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockGetRoomById).not.toHaveBeenCalled();
    });

    it("returns room for GENERAL_MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockGetRoomById.mockResolvedValue({ id: "room-1", roomNumber: "101" });

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roomNumber).toBe("101");
    });
  });

  describe("PUT /api/rooms/[id]", () => {
    const buildRequest = (body: unknown) =>
      new NextRequest("http://localhost/api/rooms/room-1", {
        method: "PUT",
        body: JSON.stringify(body),
      });

    const validUpdate = { roomNumber: "202" };

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await PUT(buildRequest(validUpdate), { params });

      expect(response.status).toBe(401);
      expect(mockUpdateRoom).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await PUT(buildRequest(validUpdate), { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockUpdateRoom).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await PUT(buildRequest(validUpdate), { params });

      expect(response.status).toBe(403);
      expect(mockUpdateRoom).not.toHaveBeenCalled();
    });

    it("updates room for GENERAL_MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockUpdateRoom.mockResolvedValue({ id: "room-1", ...validUpdate });

      const response = await PUT(buildRequest(validUpdate), { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roomNumber).toBe("202");
      expect(mockUpdateRoom).toHaveBeenCalledWith(
        "room-1",
        expect.objectContaining(validUpdate),
      );
    });

    it("returns 400 for invalid input", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);

      const response = await PUT(buildRequest({ capacity: 999 }), { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(mockUpdateRoom).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/rooms/[id]", () => {
    const req = new Request("http://localhost/api/rooms/room-1", {
      method: "DELETE",
    });

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await DELETE(req, { params });

      expect(response.status).toBe(401);
      expect(mockDeleteRoom).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await DELETE(req, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockDeleteRoom).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await DELETE(req, { params });

      expect(response.status).toBe(403);
      expect(mockDeleteRoom).not.toHaveBeenCalled();
    });

    it("deletes room for GENERAL_MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockDeleteRoom.mockResolvedValue(undefined);

      const response = await DELETE(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Room deleted successfully");
      expect(mockDeleteRoom).toHaveBeenCalledWith("room-1");
    });
  });
});
