import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, after } from "next/server";
import { ValidationError, RateLimitError } from "@/lib/errors";

const mockGetServerSession = vi.fn();
const mockGetAllStaff = vi.fn();
const mockInviteStaff = vi.fn();

// after() is passed through to the service as deferSend; the route itself
// never schedules work, so a stub is enough to assert identity.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server"
  );
  return { ...actual, after: vi.fn() };
});

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/staff", () => ({
  getAllStaff: (...args: unknown[]) => mockGetAllStaff(...args),
  inviteStaff: (...args: unknown[]) => mockInviteStaff(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
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
      expect(mockInviteStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is STAFF", async () => {
      mockGetServerSession.mockResolvedValue(staffSession);

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockInviteStaff).not.toHaveBeenCalled();
    });

    it("returns 403 when user is MANAGER (GM-only endpoint)", async () => {
      mockGetServerSession.mockResolvedValue(managerSession);

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
      expect(mockInviteStaff).not.toHaveBeenCalled();
    });

    it("delegates to inviteStaff with the validated body, the GM id and after(), and returns 201", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      const created = { id: "new-staff", ...validCreateInput };
      mockInviteStaff.mockResolvedValue(created);

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("new-staff");
      // Response body must NOT include the raw setup token.
      expect(data.setupToken).toBeUndefined();

      expect(mockInviteStaff).toHaveBeenCalledTimes(1);
      expect(mockInviteStaff).toHaveBeenCalledWith(
        expect.objectContaining({ email: validCreateInput.email }),
        gmSession.user.id,
        after
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
      expect(mockInviteStaff).not.toHaveBeenCalled();
    });

    it("passes the service's allowlist refusal through as 400", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockInviteStaff.mockRejectedValue(
        new ValidationError(
          "Recipient email domain is not allowed on this deployment."
        )
      );

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toMatch(/domain is not allowed/i);
    });

    it("passes the service's rate-limit refusal through as 429", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockInviteStaff.mockRejectedValue(
        new RateLimitError("Too many staff invites. Try again later.")
      );

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.code).toBe("RATE_LIMITED");
    });
  });
});
