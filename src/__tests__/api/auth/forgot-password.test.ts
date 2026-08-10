import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitError } from "@/lib/errors";

const mockRequestPasswordReset = vi.fn();

// after() from next/server: the route passes the imported `after` as
// the service's deferSend arg. We mock it to capture the reference and
// assert the wiring without needing a real Next request context.
const { mockAfter } = vi.hoisted(() => ({
  mockAfter: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server"
  );
  return {
    ...actual,
    after: mockAfter,
  };
});

vi.mock("@/lib/services/password-reset-service", () => ({
  requestPasswordReset: (...args: unknown[]) =>
    mockRequestPasswordReset(...args),
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

describe("POST /api/auth/forgot-password (route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for an invalid email", async () => {
    const response = await POST(makeRequest({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it("returns 200 and delegates to the service on happy path", async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ email: "Jane@Example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    expect(mockRequestPasswordReset).toHaveBeenCalledTimes(1);
    const [payload, deferArg] = mockRequestPasswordReset.mock.calls[0];
    // Zod normalizes the email to lowercase before it reaches the service.
    expect(payload.email).toBe("jane@example.com");
    expect(typeof payload.ip).toBe("string");
    // The route must pass `after` (our mock) as the deferSend arg so the
    // service can schedule post-response work without importing next/server.
    expect(deferArg).toBe(mockAfter);
  });

  it("propagates RateLimitError as 429 via handleApiError", async () => {
    mockRequestPasswordReset.mockRejectedValue(
      new RateLimitError("Too many reset requests. Try again later."),
    );

    const response = await POST(makeRequest({ email: "jane@example.com" }));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.code).toBe("RATE_LIMITED");
    expect(data.error).toMatch(/too many reset requests/i);
  });
});
