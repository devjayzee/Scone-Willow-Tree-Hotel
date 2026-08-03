import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();
const mockGetAllStaff = vi.fn();
const mockCreateStaff = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/staff-service", () => ({
  getAllStaff: (...args: unknown[]) => mockGetAllStaff(...args),
  createStaff: (...args: unknown[]) => mockCreateStaff(...args),
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

import { GET, POST } from "@/app/api/staffs/route";

describe("Staffs API", () => {
  const staffSession = {
    user: { id: "u1", email: "s@example.com", role: "STAFF" },
  };
  const managerSession = {
    user: { id: "u2", email: "m@example.com", role: "MANAGER" },
  };
  const gmSession = {
    user: { id: "u3", email: "gm@example.com", role: "GENERAL_MANAGER" },
  };

  const validCreateInput = {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
    password: "StrongP@ss1",
    role: "STAFF" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/staffs", () => {
    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
      expect(mockGetAllStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockGetAllStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockGetAllStaff).not.toHaveBeenCalled();
    });

    it("returns staff list for GENERAL_MANAGER", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      const staffList = [{ id: "s1" }, { id: "s2" }];
      mockGetAllStaff.mockResolvedValue(staffList);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(staffList);
    });

    it("surfaces service errors as 500", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockGetAllStaff.mockRejectedValue(new Error("Database error"));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("POST /api/staffs", () => {
    const buildRequest = (body: unknown) =>
      new NextRequest("http://localhost/api/staffs", {
        method: "POST",
        body: JSON.stringify(body),
      });

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await POST(buildRequest(validCreateInput));

      expect(response.status).toBe(401);
      expect(mockCreateStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockCreateStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockCreateStaff).not.toHaveBeenCalled();
    });

    it("creates staff for GENERAL_MANAGER with valid input", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      const created = { id: "new-staff", ...validCreateInput };
      mockCreateStaff.mockResolvedValue(created);

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("new-staff");
      expect(mockCreateStaff).toHaveBeenCalledWith(
        expect.objectContaining({ email: validCreateInput.email }),
        gmSession.user.id,
      );
    });

    it("returns 400 for invalid input", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);

      const response = await POST(
        buildRequest({ firstName: "Only", lastName: "Half" }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(mockCreateStaff).not.toHaveBeenCalled();
    });
  });
});
