import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();
const mockGetStaffById = vi.fn();
const mockUpdateStaff = vi.fn();
const mockDeleteStaff = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/staff-service", () => ({
  getStaffById: (...args: unknown[]) => mockGetStaffById(...args),
  updateStaff: (...args: unknown[]) => mockUpdateStaff(...args),
  deleteStaff: (...args: unknown[]) => mockDeleteStaff(...args),
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

import { GET, PUT, DELETE } from "@/app/api/staffs/[id]/route";

const params = Promise.resolve({ id: "staff-1" });

describe("Staffs [id] API", () => {
  const staffSession = {
    user: { id: "u1", email: "s@example.com", role: "STAFF" },
  };
  const managerSession = {
    user: { id: "u2", email: "m@example.com", role: "MANAGER" },
  };
  const gmSession = {
    user: { id: "gm", email: "gm@example.com", role: "GENERAL_MANAGER" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/staffs/[id]", () => {
    const req = new Request("http://localhost/api/staffs/staff-1");

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await GET(req, { params });

      expect(response.status).toBe(401);
      expect(mockGetStaffById).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockGetStaffById).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await GET(req, { params });

      expect(response.status).toBe(403);
      expect(mockGetStaffById).not.toHaveBeenCalled();
    });

    it("returns staff for GENERAL_MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockGetStaffById.mockResolvedValue({ id: "staff-1", email: "a@b.com" });

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ id: "staff-1", email: "a@b.com" });
      expect(mockGetStaffById).toHaveBeenCalledWith("staff-1");
    });
  });

  describe("PUT /api/staffs/[id]", () => {
    const buildRequest = (body: unknown) =>
      new NextRequest("http://localhost/api/staffs/staff-1", {
        method: "PUT",
        body: JSON.stringify(body),
      });

    const validUpdate = { firstName: "Updated" };

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await PUT(buildRequest(validUpdate), { params });

      expect(response.status).toBe(401);
      expect(mockUpdateStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await PUT(buildRequest(validUpdate), { params });

      expect(response.status).toBe(403);
      expect(mockUpdateStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await PUT(buildRequest(validUpdate), { params });

      expect(response.status).toBe(403);
      expect(mockUpdateStaff).not.toHaveBeenCalled();
    });

    it("updates staff for GENERAL_MANAGER and threads currentUserId", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockUpdateStaff.mockResolvedValue({ id: "staff-1", ...validUpdate });

      const response = await PUT(buildRequest(validUpdate), { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.firstName).toBe("Updated");
      expect(mockUpdateStaff).toHaveBeenCalledWith(
        "staff-1",
        expect.objectContaining(validUpdate),
        gmSession.user.id,
      );
    });

    it("returns 400 for invalid input", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);

      const response = await PUT(buildRequest({ email: "not-an-email" }), {
        params,
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(mockUpdateStaff).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/staffs/[id]", () => {
    const req = new Request("http://localhost/api/staffs/staff-1", {
      method: "DELETE",
    });

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await DELETE(req, { params });

      expect(response.status).toBe(401);
      expect(mockDeleteStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await DELETE(req, { params });

      expect(response.status).toBe(403);
      expect(mockDeleteStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await DELETE(req, { params });

      expect(response.status).toBe(403);
      expect(mockDeleteStaff).not.toHaveBeenCalled();
    });

    it("deletes staff for GENERAL_MANAGER and threads currentUserId", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockDeleteStaff.mockResolvedValue({
        deleted: true,
        deactivated: false,
        message: "Staff deleted successfully",
      });

      const response = await DELETE(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Staff deleted successfully");
      expect(data.deactivated).toBe(false);
      expect(mockDeleteStaff).toHaveBeenCalledWith("staff-1", gmSession.user.id);
    });

    it("returns deactivated response when service deactivates instead of deletes", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockDeleteStaff.mockResolvedValue({
        deleted: false,
        deactivated: true,
        message: "Staff deactivated (has active bookings)",
      });

      const response = await DELETE(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deactivated).toBe(true);
    });
  });
});
