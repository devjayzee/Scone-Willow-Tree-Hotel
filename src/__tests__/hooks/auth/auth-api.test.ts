import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchLoginRateLimitStatus } from "@/hooks/auth/auth-api";

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
