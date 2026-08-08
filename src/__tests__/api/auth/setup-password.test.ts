import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError } from "@/lib/errors";

const mockConsumeSetupToken = vi.fn();

vi.mock("@/lib/services/password-reset-service", () => ({
  consumeSetupToken: (...args: unknown[]) => mockConsumeSetupToken(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST } from "@/app/api/auth/setup-password/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/setup-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/setup-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and consumes the setup token on the happy path", async () => {
    mockConsumeSetupToken.mockResolvedValue({ userId: "u1" });

    const response = await POST(
      makeRequest({ token: "raw-token", password: "NewStr0ng!Pass" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockConsumeSetupToken).toHaveBeenCalledWith({
      rawToken: "raw-token",
      newPassword: "NewStr0ng!Pass",
    });
  });

  it("returns 400 for a weak password", async () => {
    const response = await POST(
      makeRequest({ token: "raw-token", password: "weak" })
    );

    expect(response.status).toBe(400);
    expect(mockConsumeSetupToken).not.toHaveBeenCalled();
  });

  it("returns 404 for an invalid or expired token", async () => {
    mockConsumeSetupToken.mockRejectedValue(
      new NotFoundError("This link is invalid or has expired")
    );

    const response = await POST(
      makeRequest({ token: "stale", password: "NewStr0ng!Pass" })
    );

    expect(response.status).toBe(404);
  });
});
