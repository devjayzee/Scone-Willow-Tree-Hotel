import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Upstash — class-based, since `new Ratelimit(...)` / `new Redis(...)`
// can't be constructed from arrow-function vi.fn implementations. Same
// pattern used in middleware.test.ts and auth.test.ts.
const mockGetRemaining = vi.fn();
const mockLimit = vi.fn();
const constructed: Array<{ prefix: string; limiter: unknown }> = [];
// Prefix of the instance each .limit() call came from, to tell limiters apart.
const limitCallPrefixes: string[] = [];
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    prefix: string;
    constructor(opts: { prefix: string; limiter: unknown }) {
      this.prefix = opts.prefix;
      constructed.push(opts);
    }
    getRemaining(...args: unknown[]) {
      return mockGetRemaining(...args);
    }
    limit(...args: unknown[]) {
      limitCallPrefixes.push(this.prefix);
      return mockLimit(...args);
    }
    static slidingWindow(...args: unknown[]) {
      return `sliding-window:${args.join(":")}`;
    }
  }
  return { Ratelimit };
});

vi.mock("@upstash/redis", () => {
  class Redis {}
  return { Redis };
});

// Env vars must be set before importing so the lazy singleton latches to the
// mocked Ratelimit. Individual tests can reset per-case via vi.resetModules.
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

import { RateLimitError } from "@/lib/errors";
import {
  getApiRateLimiter,
  getLoginRateLimiter,
  getLoginRateLimitStatus,
  getLoginPrecheckStatus,
  getStaffInviteRateLimiter,
  getStaffInviteGlobalRateLimiter,
} from "@/lib/services/rate-limit-service";

describe("rate-limit-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitCallPrefixes.length = 0;
  });

  describe("getLoginRateLimiter", () => {
    it("returns a singleton across calls", () => {
      const a = getLoginRateLimiter();
      const b = getLoginRateLimiter();
      expect(a).toBe(b);
      expect(a).not.toBeNull();
    });

    it("returns null when Upstash env vars are missing", async () => {
      vi.resetModules();
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const mod = await import("@/lib/services/rate-limit-service");
      expect(mod.getLoginRateLimiter()).toBeNull();

      vi.unstubAllEnvs();
    });
  });

  describe("getLoginRateLimitStatus", () => {
    it("returns the sentinel when Upstash is unconfigured", async () => {
      vi.resetModules();
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const mod = await import("@/lib/services/rate-limit-service");
      const status = await mod.getLoginRateLimitStatus("203.0.113.7");

      expect(status).toEqual({ limited: false, remaining: 999, resetAt: 0 });

      vi.unstubAllEnvs();
    });

    it("returns limited=false when attempts remain", async () => {
      mockGetRemaining.mockResolvedValue({ remaining: 3, reset: 1_800_000 });

      const status = await getLoginRateLimitStatus("203.0.113.7");

      expect(status).toEqual({
        limited: false,
        remaining: 3,
        resetAt: 1_800_000,
      });
      expect(mockGetRemaining).toHaveBeenCalledWith("203.0.113.7");
    });

    it("returns limited=true when remaining === 0", async () => {
      mockGetRemaining.mockResolvedValue({ remaining: 0, reset: 2_700_000 });

      const status = await getLoginRateLimitStatus("203.0.113.7");

      expect(status).toEqual({ limited: true, remaining: 0, resetAt: 2_700_000 });
    });

    it("uses getRemaining (does NOT consume a token via limit())", async () => {
      mockGetRemaining.mockResolvedValue({ remaining: 5, reset: 1_000 });

      await getLoginRateLimitStatus("203.0.113.7");

      expect(mockGetRemaining).toHaveBeenCalledTimes(1);
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe("getLoginPrecheckStatus", () => {
    // Restore env even when an assertion throws, so a failure here cannot
    // leak a blank Upstash config into later tests.
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("throws RateLimitError without reading login status when the gate denies", async () => {
      mockLimit.mockResolvedValue({ success: false });

      const call = getLoginPrecheckStatus("203.0.113.7");

      await expect(call).rejects.toThrow(RateLimitError);
      await expect(call).rejects.toThrow("Too many requests. Try again shortly.");
      expect(mockLimit).toHaveBeenCalledWith("203.0.113.7");
      expect(mockGetRemaining).not.toHaveBeenCalled();
    });

    it("returns the login status for the IP when the gate allows", async () => {
      mockLimit.mockResolvedValue({ success: true });
      mockGetRemaining.mockResolvedValue({ remaining: 3, reset: 1_800_000 });

      const status = await getLoginPrecheckStatus("203.0.113.7");

      expect(status).toEqual({
        limited: false,
        remaining: 3,
        resetAt: 1_800_000,
      });
      expect(mockGetRemaining).toHaveBeenCalledWith("203.0.113.7");
    });

    it("still reports a real lockout when the gate allows", async () => {
      mockLimit.mockResolvedValue({ success: true });
      mockGetRemaining.mockResolvedValue({ remaining: 0, reset: 2_700_000 });

      const status = await getLoginPrecheckStatus("203.0.113.7");

      expect(status).toEqual({ limited: true, remaining: 0, resetAt: 2_700_000 });
    });

    it("gates with the rate-limit-status limiter, never the login limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      mockGetRemaining.mockResolvedValue({ remaining: 3, reset: 1_800_000 });

      await getLoginPrecheckStatus("203.0.113.7");

      expect(mockLimit).toHaveBeenCalledTimes(1);
      expect(mockLimit).toHaveBeenCalledWith("203.0.113.7");
      expect(limitCallPrefixes).toEqual(["ratelimit:rate-limit-status"]);
      expect(limitCallPrefixes).not.toContain("ratelimit:login");
    });

    it("returns the sentinel status when Upstash is unconfigured (no gate)", async () => {
      vi.resetModules();
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const mod = await import("@/lib/services/rate-limit-service");
      const status = await mod.getLoginPrecheckStatus("203.0.113.7");

      expect(status).toEqual({ limited: false, remaining: 999, resetAt: 0 });
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe("getApiRateLimiter", () => {
    it("returns a singleton across calls", () => {
      const a = getApiRateLimiter();
      const b = getApiRateLimiter();
      expect(a).toBe(b);
      expect(a).not.toBeNull();
    });

    it("returns null when Upstash env vars are missing", async () => {
      vi.resetModules();
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const mod = await import("@/lib/services/rate-limit-service");
      expect(mod.getApiRateLimiter()).toBeNull();

      vi.unstubAllEnvs();
    });

    it("is a distinct instance from the login limiter (different prefixes)", () => {
      const login = getLoginRateLimiter();
      const api = getApiRateLimiter();
      expect(api).not.toBe(login);
    });
  });

  describe("getStaffInviteGlobalRateLimiter", () => {
    it("is a singleton, distinct from the per-GM invite limiter", () => {
      const a = getStaffInviteGlobalRateLimiter();
      expect(a).not.toBeNull();
      expect(getStaffInviteGlobalRateLimiter()).toBe(a);
      expect(a).not.toBe(getStaffInviteRateLimiter());
    });

    it("uses a 20 / 1 h sliding window under the global prefix", async () => {
      vi.resetModules();
      constructed.length = 0;

      const mod = await import("@/lib/services/rate-limit-service");
      mod.getStaffInviteGlobalRateLimiter();

      expect(constructed).toEqual([
        expect.objectContaining({
          prefix: "ratelimit:staff-invite-global",
          limiter: "sliding-window:20:1 h",
        }),
      ]);
    });

    it("returns null when Upstash env vars are missing", async () => {
      vi.resetModules();
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const mod = await import("@/lib/services/rate-limit-service");
      expect(mod.getStaffInviteGlobalRateLimiter()).toBeNull();

      vi.unstubAllEnvs();
    });
  });
});
