import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError } from "@/lib/errors";

const mockConsumeSetupToken = vi.fn();

vi.mock("@/lib/services/password-reset-service", () => ({
  consumeSetupToken: (...args: unknown[]) => mockConsumeSetupToken(...args),
}));

const mockTrustCompletingBrowser = vi.fn();
vi.mock("@/lib/utils/trust-browser", () => ({
  trustCompletingBrowser: (...args: unknown[]) =>
    mockTrustCompletingBrowser(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST } from "@/app/api/auth/setup-password/route";
import { logger } from "@/lib/logger";

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
    mockConsumeSetupToken.mockResolvedValue({
      userId: "u1",
      email: "jane@example.com",
      validAfter: 1_800_000_123,
    });
    mockTrustCompletingBrowser.mockResolvedValue(undefined);

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

  it("trusts the completing browser once with the email and validAfter from the consume result", async () => {
    mockConsumeSetupToken.mockResolvedValue({
      userId: "u1",
      email: "jane@example.com",
      validAfter: 1_800_000_123,
    });
    mockTrustCompletingBrowser.mockResolvedValue(undefined);

    const response = await POST(
      makeRequest({ token: "raw-token", password: "NewStr0ng!Pass" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockTrustCompletingBrowser).toHaveBeenCalledTimes(1);
    expect(mockTrustCompletingBrowser).toHaveBeenCalledWith(
      "jane@example.com",
      1_800_000_123
    );
    expect(mockConsumeSetupToken.mock.invocationCallOrder[0]).toBeLessThan(
      mockTrustCompletingBrowser.mock.invocationCallOrder[0]
    );
  });

  it("passes a null validAfter through", async () => {
    mockConsumeSetupToken.mockResolvedValue({
      userId: "u1",
      email: "jane@example.com",
      validAfter: null,
    });
    mockTrustCompletingBrowser.mockResolvedValue(undefined);

    await POST(makeRequest({ token: "raw-token", password: "NewStr0ng!Pass" }));

    expect(mockTrustCompletingBrowser).toHaveBeenCalledWith(
      "jane@example.com",
      null
    );
  });

  it("does not trust the browser on a 400", async () => {
    const response = await POST(makeRequest({ token: "", password: "weak" }));

    expect(response.status).toBe(400);
    expect(mockTrustCompletingBrowser).not.toHaveBeenCalled();
  });

  it("does not trust the browser when the consume throws a 500", async () => {
    mockConsumeSetupToken.mockRejectedValue(new Error("db down"));

    const response = await POST(
      makeRequest({ token: "raw-token", password: "NewStr0ng!Pass" })
    );

    expect(response.status).toBe(500);
    expect(mockTrustCompletingBrowser).not.toHaveBeenCalled();
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
    expect(mockTrustCompletingBrowser).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/setup-password content type", () => {
  const goodBody = { token: "raw-token", password: "NewStr0ng!Pass" };
  const withType = (contentType: string | null, body: string | Blob) => {
    const headers: Record<string, string> = {};
    if (contentType !== null) headers["Content-Type"] = contentType;
    return new Request("http://localhost/api/auth/setup-password", {
      method: "POST",
      headers,
      body,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumeSetupToken.mockResolvedValue({
      userId: "u1",
      email: "jane@example.com",
      validAfter: 1_800_000_123,
    });
    mockTrustCompletingBrowser.mockResolvedValue(undefined);
  });

  it.each([
    ["text/plain", JSON.stringify(goodBody)],
    ["text/plain;charset=UTF-8", JSON.stringify(goodBody)],
    // The cross-site attack: an enctype="text/plain" form posts name=value,
    // so the pair {"token":"T","password":"P","x":"="} is valid JSON.
    ["text/plain", '{"token":"raw-token","password":"NewStr0ng!Pass","x":"="}'],
    ["application/x-www-form-urlencoded", JSON.stringify(goodBody)],
    ["multipart/form-data; boundary=x", JSON.stringify(goodBody)],
    ["application/jsonp", JSON.stringify(goodBody)],
    ["application/json-patch+json", JSON.stringify(goodBody)],
  ])("refuses %s with 415 and neither consumes nor trusts", async (type, body) => {
    const response = await POST(withType(type, body));

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ error: expect.any(String) });
    expect(mockConsumeSetupToken).not.toHaveBeenCalled();
    expect(mockTrustCompletingBrowser).not.toHaveBeenCalled();
  });

  it("refuses a missing Content-Type with 415 and neither consumes nor trusts", async () => {
    const response = await POST(
      withType(null, new Blob([JSON.stringify(goodBody)]))
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ error: expect.any(String) });
    expect(mockConsumeSetupToken).not.toHaveBeenCalled();
    expect(mockTrustCompletingBrowser).not.toHaveBeenCalled();
  });

  it.each([
    "application/json",
    "application/json; charset=utf-8",
    "Application/JSON",
    "  application/json ;charset=utf-8",
  ])("guard: accepts %s and reaches the consume", async (type) => {
    const response = await POST(withType(type, JSON.stringify(goodBody)));

    expect(response.status).toBe(200);
    expect(mockConsumeSetupToken).toHaveBeenCalledTimes(1);
    expect(mockTrustCompletingBrowser).toHaveBeenCalledTimes(1);
  });

  describe("malformed JSON body", () => {
    it("returns 400 INVALID_JSON for a malformed body", async () => {
      const request = new Request("http://localhost/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("INVALID_JSON");
      expect(data.error).toBe("Request body must be valid JSON");
      expect(logger.error).not.toHaveBeenCalled();
      expect(mockConsumeSetupToken).not.toHaveBeenCalled();
    });

    it("refuses a malformed body sent as text/plain with 415, not 400", async () => {
      const request = new Request("http://localhost/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{not json",
      });

      const response = await POST(request);

      expect(response.status).toBe(415);
      expect(mockConsumeSetupToken).not.toHaveBeenCalled();
    });
  });
});
