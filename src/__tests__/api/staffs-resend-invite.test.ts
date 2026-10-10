import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, after } from "next/server";
import {
  NotFoundError,
  BusinessRuleError,
  ValidationError,
  RateLimitError,
} from "@/lib/errors";

const mockGetServerSession = vi.fn();
const mockResendInvite = vi.fn();

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
  resendInvite: (...args: unknown[]) => mockResendInvite(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { POST } from "@/app/api/staffs/[id]/resend-invite/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/staffs/u1/resend-invite", {
    method: "POST",
  });
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/staffs/[id]/resend-invite", () => {
  const staffSession = {
    user: { id: "u-staff", role: "STAFF" as const },
  };
  const managerSession = {
    user: { id: "u-manager", role: "MANAGER" as const },
  };
  const gmSession = {
    user: { id: "u-gm", role: "GENERAL_MANAGER" as const },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(makeRequest(), makeParams("u1"));

    expect(response.status).toBe(401);
    expect(mockResendInvite).not.toHaveBeenCalled();
  });

  it("returns 403 for STAFF", async () => {
    mockGetServerSession.mockResolvedValue(staffSession);

    const response = await POST(makeRequest(), makeParams("u1"));

    expect(response.status).toBe(403);
    expect(mockResendInvite).not.toHaveBeenCalled();
  });

  it("returns 403 for MANAGER (GM-only)", async () => {
    mockGetServerSession.mockResolvedValue(managerSession);

    const response = await POST(makeRequest(), makeParams("u1"));

    expect(response.status).toBe(403);
    expect(mockResendInvite).not.toHaveBeenCalled();
  });

  it("delegates to resendInvite with the id, the GM id and after(), and returns { ok: true }", async () => {
    mockGetServerSession.mockResolvedValue(gmSession);
    mockResendInvite.mockResolvedValue(undefined);

    const response = await POST(makeRequest(), makeParams("u1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockResendInvite).toHaveBeenCalledTimes(1);
    expect(mockResendInvite).toHaveBeenCalledWith("u1", "u-gm", after);
  });

  it("returns 404 when the user doesn't exist", async () => {
    mockGetServerSession.mockResolvedValue(gmSession);
    mockResendInvite.mockRejectedValue(new NotFoundError("Staff not found"));

    const response = await POST(makeRequest(), makeParams("ghost"));

    expect(response.status).toBe(404);
  });

  it("returns 400 when the staff member is already active", async () => {
    mockGetServerSession.mockResolvedValue(gmSession);
    mockResendInvite.mockRejectedValue(
      new BusinessRuleError(
        "Cannot resend invite — this staff member has already completed setup"
      )
    );

    const response = await POST(makeRequest(), makeParams("u1"));

    expect(response.status).toBe(400);
  });

  it("passes the service deactivated-account refusal through as 400 BUSINESS_RULE_VIOLATION", async () => {
    mockGetServerSession.mockResolvedValue(gmSession);
    mockResendInvite.mockRejectedValue(
      new BusinessRuleError(
        "This account has been deactivated. Use Activate to restore access."
      )
    );

    const response = await POST(makeRequest(), makeParams("u1"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(data)).toContain("BUSINESS_RULE_VIOLATION");
  });

  it("passes the service's allowlist refusal through as 400", async () => {
    mockGetServerSession.mockResolvedValue(gmSession);
    mockResendInvite.mockRejectedValue(
      new ValidationError(
        "Recipient email domain is not allowed on this deployment."
      )
    );

    const response = await POST(makeRequest(), makeParams("u1"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("passes the service's rate-limit refusal through as 429", async () => {
    mockGetServerSession.mockResolvedValue(gmSession);
    mockResendInvite.mockRejectedValue(
      new RateLimitError("Too many staff invites. Try again later.")
    );

    const response = await POST(makeRequest(), makeParams("u1"));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.code).toBe("RATE_LIMITED");
  });
});
