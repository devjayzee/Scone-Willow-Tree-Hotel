import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next-auth/middleware — the real withAuth wraps our inner function and
// populates req.nextauth.token from the JWT. For unit tests we bypass the JWT
// step: withAuth becomes a passthrough that just invokes the inner fn with
// whatever the test has attached to req.nextauth.
vi.mock("next-auth/middleware", () => ({
  withAuth: (fn: (req: unknown) => unknown) => {
    return (req: unknown) => fn(req);
  },
}));

// Mock next-auth/jwt — apiRateLimitMiddleware reads the token to key the
// per-user API limit (#116). Individual tests override to simulate presence
// or absence of a session.
const mockGetToken = vi.fn();
vi.mock("next-auth/jwt", () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

// Mock Upstash — class-based, since `new Ratelimit(...)` / `new Redis(...)`
// don't work with arrow-function vi.fn implementations.
const mockLimit = vi.fn();
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
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

vi.mock("@/lib/utils/get-client-ip", () => ({
  getClientIp: () => "203.0.113.7",
}));

// Force the middleware's lazy Upstash init so mockLimit gets a chance to run.
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

import middleware from "@/middleware";
import { NextResponse } from "next/server";

type Token = {
  role?: "GENERAL_MANAGER" | "MANAGER" | "STAFF";
  [k: string]: unknown;
} | null;

// Minimal NextRequest shim — the middleware only reads .headers, .method,
// .nextUrl.pathname, .url, and .nextauth.token.
function buildReq(opts: {
  path: string;
  method?: string;
  token?: Token;
  headers?: Record<string, string>;
}) {
  const url = `http://localhost${opts.path}`;
  return {
    url,
    method: opts.method ?? "GET",
    headers: new Headers(opts.headers ?? {}),
    nextUrl: { pathname: opts.path },
    nextauth: { token: opts.token ?? null },
  } as unknown as Parameters<typeof middleware>[0];
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit is available. Individual tests override.
    mockLimit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 5,
      reset: Date.now() + 60_000,
    });
    // Default: no session token — tests that need one override.
    mockGetToken.mockResolvedValue(null);
  });

  describe("page role-gate redirects", () => {
    const stafflikeCases = [
      { path: "/rooms", role: "STAFF" as const },
      { path: "/rooms/room-1", role: "STAFF" as const },
      { path: "/reports", role: "STAFF" as const },
      { path: "/reports/revenue", role: "STAFF" as const },
    ];

    for (const { path, role } of stafflikeCases) {
      it(`redirects ${path} to /bookings when token role is ${role}`, async () => {
        const req = buildReq({ path, token: { role } });

        const response = (await middleware(req)) as NextResponse;

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
          "http://localhost/bookings",
        );
      });
    }

    it("allows /rooms for MANAGER", async () => {
      const req = buildReq({ path: "/rooms", token: { role: "MANAGER" } });

      const response = (await middleware(req)) as NextResponse;

      // NextResponse.next() has no redirect header
      expect(response.headers.get("location")).toBeNull();
    });

    it("allows /reports for GENERAL_MANAGER", async () => {
      const req = buildReq({
        path: "/reports",
        token: { role: "GENERAL_MANAGER" },
      });

      const response = (await middleware(req)) as NextResponse;

      expect(response.headers.get("location")).toBeNull();
    });

    it("redirects /staff to /bookings when token role is MANAGER", async () => {
      const req = buildReq({ path: "/staff", token: { role: "MANAGER" } });

      const response = (await middleware(req)) as NextResponse;

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost/bookings",
      );
    });

    it("redirects /staff to /bookings when token role is STAFF", async () => {
      const req = buildReq({ path: "/staff", token: { role: "STAFF" } });

      const response = (await middleware(req)) as NextResponse;

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost/bookings",
      );
    });

    it("allows /staff for GENERAL_MANAGER", async () => {
      const req = buildReq({
        path: "/staff",
        token: { role: "GENERAL_MANAGER" },
      });

      const response = (await middleware(req)) as NextResponse;

      expect(response.headers.get("location")).toBeNull();
    });

    it("redirects authenticated user from /login to /bookings", async () => {
      const req = buildReq({ path: "/login", token: { role: "STAFF" } });

      const response = (await middleware(req)) as NextResponse;

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost/bookings",
      );
    });
  });

  describe("credentials rate limit", () => {
    it("returns 429 when limiter reports success: false", async () => {
      mockLimit.mockResolvedValue({
        success: false,
        limit: 5,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const req = buildReq({
        path: "/api/auth/callback/credentials",
        method: "POST",
      });

      const response = (await middleware(req)) as NextResponse;
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toMatch(/too many login attempts/i);
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("passes through when limiter reports success: true", async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 5,
        remaining: 4,
        reset: Date.now() + 60_000,
      });

      const req = buildReq({
        path: "/api/auth/callback/credentials",
        method: "POST",
      });

      const response = (await middleware(req)) as NextResponse;

      // Not a 429 — the wrapped auth middleware runs next and returns .next()
      expect(response.status).not.toBe(429);
    });

    it("does not rate-limit GET on the credentials callback", async () => {
      const req = buildReq({
        path: "/api/auth/callback/credentials",
        method: "GET",
      });

      await middleware(req);

      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("does not rate-limit other paths", async () => {
      const req = buildReq({
        path: "/api/auth/session",
        method: "POST",
      });

      await middleware(req);

      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe("body-size cap (#117)", () => {
    it("returns 413 when POST content-length exceeds the cap", async () => {
      const req = buildReq({
        path: "/api/bookings",
        method: "POST",
        headers: { "content-length": "200000" },
      });

      const response = (await middleware(req)) as NextResponse;
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error).toMatch(/too large/i);
      // Rate limiter should not fire — cap runs first
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("passes a normal-sized POST through", async () => {
      const req = buildReq({
        path: "/api/bookings",
        method: "POST",
        headers: { "content-length": "1024" },
      });

      const response = (await middleware(req)) as NextResponse;

      expect(response.status).not.toBe(413);
    });

    it("ignores content-length on GET (never carries a body)", async () => {
      const req = buildReq({
        path: "/api/bookings",
        method: "GET",
        headers: { "content-length": "999999" },
      });

      const response = (await middleware(req)) as NextResponse;

      expect(response.status).not.toBe(413);
    });
  });

  describe("per-user API rate limit (#116)", () => {
    it("returns 429 when the api limiter says the caller is over quota", async () => {
      mockGetToken.mockResolvedValue({ id: "user-abc" });
      mockLimit.mockResolvedValue({
        success: false,
        limit: 120,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const req = buildReq({ path: "/api/bookings", method: "GET" });
      const response = (await middleware(req)) as NextResponse;
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toMatch(/too many requests/i);
      // Key should be the userId, not the IP fallback
      expect(mockLimit).toHaveBeenCalledWith("user-abc");
    });

    it("keys on IP when the request is unauthenticated", async () => {
      mockGetToken.mockResolvedValue(null);
      mockLimit.mockResolvedValue({
        success: true,
        limit: 120,
        remaining: 119,
        reset: Date.now() + 60_000,
      });

      const req = buildReq({ path: "/api/bookings", method: "GET" });
      await middleware(req);

      // Falls back to `ip:<clientIp>` when no token — clientIp mocked to 203.0.113.7
      expect(mockLimit).toHaveBeenCalledWith("ip:203.0.113.7");
    });

    it("does not touch the api limiter for /api/auth/*", async () => {
      const req = buildReq({
        path: "/api/auth/session",
        method: "GET",
      });
      await middleware(req);

      // /api/auth/* skips the api limiter branch entirely
      expect(mockGetToken).not.toHaveBeenCalled();
    });

    it("does not touch the api limiter for non-API routes", async () => {
      const req = buildReq({
        path: "/bookings",
        method: "GET",
        token: { role: "STAFF" },
      });
      await middleware(req);

      expect(mockGetToken).not.toHaveBeenCalled();
    });
  });

  describe("non-auth API paths skip withAuth (#117 companion)", () => {
    // Non-auth API routes handle their own session check in the handler
    // (Rule 4). Middleware must NOT 302 unauthenticated API calls to /login.
    it("does not redirect unauthenticated /api/bookings", async () => {
      const req = buildReq({ path: "/api/bookings", token: null });

      const response = (await middleware(req)) as NextResponse;

      expect(response.headers.get("location")).toBeNull();
    });

    it("does not redirect unauthenticated /api/reports", async () => {
      const req = buildReq({ path: "/api/reports", token: null });

      const response = (await middleware(req)) as NextResponse;

      expect(response.headers.get("location")).toBeNull();
    });
  });
});
