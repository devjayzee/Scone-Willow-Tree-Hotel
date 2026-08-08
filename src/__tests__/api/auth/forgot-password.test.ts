import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIssueResetTokenForEmail = vi.fn();
const mockLimit = vi.fn();
const mockGetForgotPasswordRateLimiter = vi.fn();
const mockSend = vi.fn();

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
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
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
    mockGetForgotPasswordRateLimiter.mockReturnValue({
      limit: (...args: unknown[]) => mockLimit(...args),
    });
    mockLimit.mockResolvedValue({ success: true });
  });

  it("returns 200 and sends the email for a known address", async () => {
    mockIssueResetTokenForEmail.mockResolvedValue({
      emailedToken: "raw-token",
      user: { id: "u1", email: "jane@example.com", firstName: "Jane" },
    });

    const response = await POST(makeRequest({ email: "jane@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@example.com" })
    );
  });

  it("returns 200 without sending for an unknown address", async () => {
    mockIssueResetTokenForEmail.mockResolvedValue({
      emailedToken: null,
      user: null,
    });

    const response = await POST(makeRequest({ email: "ghost@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("still returns 200 when the mailer throws", async () => {
    mockIssueResetTokenForEmail.mockResolvedValue({
      emailedToken: "raw-token",
      user: { id: "u1", email: "jane@example.com", firstName: "Jane" },
    });
    mockSend.mockRejectedValue(new Error("smtp down"));

    const response = await POST(makeRequest({ email: "jane@example.com" }));

    expect(response.status).toBe(200);
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
