import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError, BusinessRuleError } from "@/lib/errors";

const mockGetServerSession = vi.fn();
const mockResendInvite = vi.fn();
const mockSend = vi.fn();
const mockLoggerError = vi.fn();

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
  resendInvite: (...args: unknown[]) => mockResendInvite(...args),
}));

vi.mock("@/lib/email/email-transport", () => ({
  getEmailTransport: () => ({
    send: (...args: unknown[]) => mockSend(...args),
  }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
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
    mockAfterCallbacks.length = 0;
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

  it("schedules the invite email via after() and returns { ok: true } for GENERAL_MANAGER", async () => {
    mockGetServerSession.mockResolvedValue(gmSession);
    mockResendInvite.mockResolvedValue({
      user: { id: "u1", email: "invitee@example.com", firstName: "Ivy" },
      setupToken: "raw-token",
    });

    const response = await POST(makeRequest(), makeParams("u1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockResendInvite).toHaveBeenCalledWith("u1", "u-gm");
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockAfterCallbacks).toHaveLength(1);

    await flushAfter();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "invitee@example.com" })
    );
  });

  it("returns 404 when the user doesn't exist", async () => {
    mockGetServerSession.mockResolvedValue(gmSession);
    mockResendInvite.mockRejectedValue(new NotFoundError("Staff not found"));

    const response = await POST(makeRequest(), makeParams("ghost"));

    expect(response.status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
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
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("still returns 200 and logs when the invite email fails to send", async () => {
    mockGetServerSession.mockResolvedValue(gmSession);
    mockResendInvite.mockResolvedValue({
      user: { id: "u1", email: "invitee@example.com", firstName: "Ivy" },
      setupToken: "raw-token",
    });
    mockSend.mockRejectedValue(new Error("smtp down"));

    const response = await POST(makeRequest(), makeParams("u1"));

    expect(response.status).toBe(200);
    expect(mockLoggerError).not.toHaveBeenCalled();

    await flushAfter();

    expect(mockLoggerError).toHaveBeenCalledWith(
      "Failed to resend staff invite email",
      expect.any(Error),
      { staffId: "u1" }
    );
  });
});
