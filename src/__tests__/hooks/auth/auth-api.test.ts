import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AuthApiError,
  fetchInviteToken,
  fetchLoginRateLimitStatus,
} from "@/hooks/auth/auth-api";

describe("fetchLoginRateLimitStatus", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("GETs /api/auth/rate-limit-status and returns the parsed body", async () => {
    const payload = { limited: false, remaining: 4, resetAt: 1234567890 };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await fetchLoginRateLimitStatus();

    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/rate-limit-status");
    expect(result).toEqual(payload);
  });

  it("throws a plain Error when the response is not ok", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(fetchLoginRateLimitStatus()).rejects.toThrow(
      "Failed to check rate limit"
    );
  });

  it("propagates network errors", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("network down"));
    await expect(fetchLoginRateLimitStatus()).rejects.toThrow("network down");
  });
});

describe("fetchInviteToken", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const jsonResponse = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("rejects with an AuthApiError carrying status 404 for an invalid link", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ error: "This link is invalid or has expired" }, 404)
    );

    const err = await fetchInviteToken("tok_123").catch((e) => e);

    expect(err).toBeInstanceOf(AuthApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe("This link is invalid or has expired");
  });

  it("rejects with an AuthApiError carrying status 429 when rate limited", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ error: "Too many requests" }, 429)
    );

    const err = await fetchInviteToken("tok_123").catch((e) => e);

    expect(err).toBeInstanceOf(AuthApiError);
    expect(err.status).toBe(429);
  });
});
