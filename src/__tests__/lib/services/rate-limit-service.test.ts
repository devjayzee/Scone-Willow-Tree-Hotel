import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Upstash — class-based, since `new Ratelimit(...)` / `new Redis(...)`
// can't be constructed from arrow-function vi.fn implementations. Same
// pattern used in middleware.test.ts and auth.test.ts.
const mockGetRemaining = vi.fn();
const mockLimit = vi.fn();
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    getRemaining(...args: unknown[]) {
      return mockGetRemaining(...args);
    }
    limit(...args: unknown[]) {
      return mockLimit(...args);
    }
    static slidingWindow() {
      return "sliding-window-config";
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

import {
  getLoginRateLimiter,
  getLoginRateLimitStatus,
} from "@/lib/services/rate-limit-service";

describe("rate-limit-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
