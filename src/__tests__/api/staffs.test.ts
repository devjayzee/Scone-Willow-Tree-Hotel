import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();
const mockGetAllStaff = vi.fn();
const mockCreateStaff = vi.fn();
const mockSend = vi.fn();
const mockLoggerError = vi.fn();
const mockGetStaffInviteRateLimiter = vi.fn(() => null);

// after() from next/server: collect callbacks so tests can assert the
// send was scheduled without racing on it (same pattern as
// forgot-password.test.ts).
const { mockAfterCallbacks } = vi.hoisted(() => ({
  mockAfterCallbacks: [] as Array<() => Promise<unknown>>,
}));

async function flushAfter() {
  const pending = mockAfterCallbacks.splice(0);
  for (const cb of pending) {
    await cb();
  }
}

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server"
  );
  return {
    ...actual,
    after: (task: unknown) => {
      if (typeof task === "function") {
        mockAfterCallbacks.push(task as () => Promise<unknown>);
      } else {
        mockAfterCallbacks.push(async () => task);
      }
    },
  };
});

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/services/staff", () => ({
  getAllStaff: (...args: unknown[]) => mockGetAllStaff(...args),
  createStaff: (...args: unknown[]) => mockCreateStaff(...args),
}));

vi.mock("@/lib/email/email-transport", () => ({
  getEmailTransport: () => ({
    send: (...args: unknown[]) => mockSend(...args),
  }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/services/rate-limit-service", () => ({
  getStaffInviteRateLimiter: () => mockGetStaffInviteRateLimiter(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
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
    role: "STAFF" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAfterCallbacks.length = 0;
    // Default: Upstash unconfigured → limiter disabled. Individual tests
    // that need to exercise throttling override this per case.
    mockGetStaffInviteRateLimiter.mockReturnValue(null);
    delete process.env.INVITE_DOMAIN_ALLOWLIST;
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

    it("creates staff for GENERAL_MANAGER and schedules the invite email via after()", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      const created = { id: "new-staff", ...validCreateInput };
      mockCreateStaff.mockResolvedValue({
        staff: created,
        setupToken: "raw-setup-token",
      });

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("new-staff");
      // Response body must NOT include the raw setup token.
      expect(data.setupToken).toBeUndefined();

      expect(mockCreateStaff).toHaveBeenCalledWith(
        expect.objectContaining({ email: validCreateInput.email }),
        gmSession.user.id,
      );

      // Email is scheduled for after-response, not called synchronously.
      expect(mockSend).not.toHaveBeenCalled();
      expect(mockAfterCallbacks).toHaveLength(1);

      await flushAfter();

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: validCreateInput.email })
      );
    });

    it("still returns 201 and logs when the invite email fails to send", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockCreateStaff.mockResolvedValue({
        staff: { id: "new-staff", ...validCreateInput },
        setupToken: "raw-setup-token",
      });
      mockSend.mockRejectedValue(new Error("smtp down"));

      const response = await POST(buildRequest(validCreateInput));

      expect(response.status).toBe(201);
      expect(mockLoggerError).not.toHaveBeenCalled();

      await flushAfter();

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to send staff invite email",
        expect.any(Error),
        { staffId: "new-staff" }
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

    it("returns 429 when the staff-invite rate limiter denies", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      mockGetStaffInviteRateLimiter.mockReturnValue({
        limit: async () => ({ success: false, limit: 5, remaining: 0, reset: 0 }),
      } as unknown as null);

      const response = await POST(buildRequest(validCreateInput));
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.code).toBe("RATE_LIMITED");
      expect(mockCreateStaff).not.toHaveBeenCalled();
      expect(mockAfterCallbacks).toHaveLength(0);
    });

    it("returns 400 when INVITE_DOMAIN_ALLOWLIST blocks the recipient", async () => {
      mockGetServerSession.mockResolvedValue(gmSession);
      process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.com";

      const response = await POST(
        buildRequest({
          ...validCreateInput,
          email: "attacker@evil.example",
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toMatch(/domain is not allowed/i);
      expect(mockCreateStaff).not.toHaveBeenCalled();
      expect(mockAfterCallbacks).toHaveLength(0);
    });
  });
});
