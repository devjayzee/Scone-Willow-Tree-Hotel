import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIssueResetTokenForEmail = vi.fn();
const mockLimit = vi.fn();
const mockGetForgotPasswordRateLimiter = vi.fn();
const mockSend = vi.fn();
const mockLoggerError = vi.fn();

// after() from next/server: collect callbacks so tests can either flush
// them (to prove the send eventually runs) or leave them unflushed (to
// prove the response returned without waiting for the send).
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

vi.mock("@/lib/services/password-reset-service", () => ({
  issueResetTokenForEmail: (...args: unknown[]) =>
    mockIssueResetTokenForEmail(...args),
  RESET_TOKEN_TTL_MINUTES: 30,
}));

vi.mock("@/lib/services/rate-limit-service", () => ({
  getForgotPasswordRateLimiter: (...args: unknown[]) =>
    mockGetForgotPasswordRateLimiter(...args),
}));

vi.mock("@/lib/email/transport", () => ({
  getEmailTransport: () => ({
    send: (...args: unknown[]) => mockSend(...args),
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "@/app/api/auth/forgot-password/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAfterCallbacks.length = 0;
    mockGetForgotPasswordRateLimiter.mockReturnValue({
      limit: (...args: unknown[]) => mockLimit(...args),
    });
    mockLimit.mockResolvedValue({ success: true });
  });

  it("returns 200 and sends the email for a known address (after response)", async () => {
    mockIssueResetTokenForEmail.mockResolvedValue({
      emailedToken: "raw-token",
      user: { id: "u1", email: "jane@example.com", firstName: "Jane" },
    });

    const response = await POST(makeRequest({ email: "jane@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    // Send is scheduled via after(), not called synchronously — this is the
    // whole point of the fix (no timing leak).
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockAfterCallbacks).toHaveLength(1);

    await flushAfter();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@example.com" })
    );
  });

  it("returns 200 without sending or scheduling anything for an unknown address", async () => {
    mockIssueResetTokenForEmail.mockResolvedValue({
      emailedToken: null,
      user: null,
    });

    const response = await POST(makeRequest({ email: "ghost@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockSend).not.toHaveBeenCalled();
    // No after() work queued either — nothing to run post-response.
    expect(mockAfterCallbacks).toHaveLength(0);
  });

  it("returns 200 without awaiting the send even if it hangs indefinitely", async () => {
    mockIssueResetTokenForEmail.mockResolvedValue({
      emailedToken: "raw-token",
      user: { id: "u1", email: "jane@example.com", firstName: "Jane" },
    });
    // Simulates a slow/stuck Resend call. If the response awaited this,
    // the test would hang.
    mockSend.mockReturnValue(new Promise<void>(() => {}));

    const response = await POST(makeRequest({ email: "jane@example.com" }));

    expect(response.status).toBe(200);
    // Callback is queued for post-response execution, not run yet.
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockAfterCallbacks).toHaveLength(1);
  });

  it("still returns 200 and logs when the mailer throws (from the after callback)", async () => {
    mockIssueResetTokenForEmail.mockResolvedValue({
      emailedToken: "raw-token",
      user: { id: "u1", email: "jane@example.com", firstName: "Jane" },
    });
    mockSend.mockRejectedValue(new Error("smtp down"));

    const response = await POST(makeRequest({ email: "jane@example.com" }));

    expect(response.status).toBe(200);
    expect(mockLoggerError).not.toHaveBeenCalled();

    await flushAfter();

    expect(mockLoggerError).toHaveBeenCalledWith(
      "Failed to send password-reset email",
      expect.any(Error),
      { userId: "u1" }
    );
  });

  it("consumes both the ip: and email: limiter keys", async () => {
    mockIssueResetTokenForEmail.mockResolvedValue({
      emailedToken: null,
      user: null,
    });

    await POST(makeRequest({ email: "Jane@Example.com" }));

    const keys = mockLimit.mock.calls.map((c) => c[0] as string);
    expect(keys.some((k) => k.startsWith("ip:"))).toBe(true);
    // zod normalizes the email to lowercase before it becomes a limiter key
    expect(keys).toContain("email:jane@example.com");
  });

  it("returns 429 when either limiter key is exhausted", async () => {
    mockLimit
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });

    const response = await POST(makeRequest({ email: "jane@example.com" }));

    expect(response.status).toBe(429);
    expect(mockIssueResetTokenForEmail).not.toHaveBeenCalled();
  });

  it("skips rate limiting when the limiter is unconfigured", async () => {
    mockGetForgotPasswordRateLimiter.mockReturnValue(null);
    mockIssueResetTokenForEmail.mockResolvedValue({
      emailedToken: null,
      user: null,
    });

    const response = await POST(makeRequest({ email: "jane@example.com" }));

    expect(response.status).toBe(200);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    const response = await POST(makeRequest({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(mockIssueResetTokenForEmail).not.toHaveBeenCalled();
  });
});
