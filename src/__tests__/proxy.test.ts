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
// per-user API limit. Individual tests override to simulate presence
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

// Force the proxy's lazy Upstash init so mockLimit gets a chance to run.
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

import proxy from "@/proxy";
import { NextResponse } from "next/server";

type Token = {
  role?: "GENERAL_MANAGER" | "MANAGER" | "STAFF";
  [k: string]: unknown;
} | null;

// Minimal NextRequest shim — the middleware only reads .headers, .method,
// .nextUrl.pathname, .url, and .nextauth.token. Defaults a
// `content-length: "0"` header on body-carrying methods so the
// enforceBodySizeCap doesn't 411 tests that aren't exercising it;
// the body-size-cap suite overrides this explicitly.
function buildReq(opts: {
  path: string;
  method?: string;
  token?: Token;
  headers?: Record<string, string>;
}) {
  const url = `http://localhost${opts.path}`;
  const method = opts.method ?? "GET";
  const needsLength =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const headers = new Headers(opts.headers ?? {});
  if (needsLength && !headers.has("content-length")) {
    headers.set("content-length", "0");
  }
  return {
    url,
    method,
    headers,
    nextUrl: { pathname: opts.path },
    nextauth: { token: opts.token ?? null },
  } as unknown as Parameters<typeof proxy>[0];
}

describe("proxy", () => {
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
        const req = buildReq({ path, token: { id: "u-1", role } });

        const response = (await proxy(req)) as NextResponse;

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
          "http://localhost/bookings",
        );
      });
    }

    it("allows /rooms for MANAGER", async () => {
      const req = buildReq({ path: "/rooms", token: { id: "u-1", role: "MANAGER" } });

      const response = (await proxy(req)) as NextResponse;

      // NextResponse.next() has no redirect header
      expect(response.headers.get("location")).toBeNull();
    });

    it("allows /reports for GENERAL_MANAGER", async () => {
      const req = buildReq({
        path: "/reports",
        token: { id: "u-1", role: "GENERAL_MANAGER" },
      });

      const response = (await proxy(req)) as NextResponse;

      expect(response.headers.get("location")).toBeNull();
    });

    it("redirects /staff to /bookings when token role is MANAGER", async () => {
      const req = buildReq({ path: "/staff", token: { id: "u-1", role: "MANAGER" } });

      const response = (await proxy(req)) as NextResponse;

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost/bookings",
      );
    });

    it("redirects /staff to /bookings when token role is STAFF", async () => {
      const req = buildReq({ path: "/staff", token: { id: "u-1", role: "STAFF" } });

      const response = (await proxy(req)) as NextResponse;

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost/bookings",
      );
    });

    it("allows /staff for GENERAL_MANAGER", async () => {
      const req = buildReq({
        path: "/staff",
        token: { id: "u-1", role: "GENERAL_MANAGER" },
      });

      const response = (await proxy(req)) as NextResponse;

      expect(response.headers.get("location")).toBeNull();
    });

    it("redirects authenticated user from /login to /bookings", async () => {
      const req = buildReq({ path: "/login", token: { id: "u-1", role: "STAFF" } });

      const response = (await proxy(req)) as NextResponse;

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost/bookings",
      );
    });

    const recoveryPaths = [
      "/forgot-password",
      "/reset-password",
      "/setup-password",
    ];

    for (const path of recoveryPaths) {
      it(`redirects authenticated user from ${path} to /bookings`, async () => {
        const req = buildReq({ path, token: { id: "u-1", role: "STAFF" } });

        const response = (await proxy(req)) as NextResponse;

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
          "http://localhost/bookings",
        );
      });

      it(`lets an unauthenticated visitor through to ${path}`, async () => {
        const req = buildReq({ path, token: null });

        const response = (await proxy(req)) as NextResponse;

        expect(response.headers.get("location")).toBeNull();
      });

      it(`does NOT redirect to /bookings from ${path} when the token has been invalidated (id: null)`, async () => {
        // auth.ts's jwt callback returns `{ ...token, id: null }` on
        // expiry / tokenVersion bump / deactivation. NextAuth
        // re-encodes that shape back to the cookie. If middleware
        // treats a truthy-but-nulled token as authenticated it
        // bounces the user to /bookings, whose layout gate
        // (requireSession) then bounces back to /login → infinite
        // loop. Requiring `token.id` breaks it.
        const req = buildReq({
          path,
          token: { id: null, role: "STAFF" },
        });

        const response = (await proxy(req)) as NextResponse;

        expect(response.headers.get("location")).toBeNull();
      });
    }
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

      const response = (await proxy(req)) as NextResponse;
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

      const response = (await proxy(req)) as NextResponse;

      // Not a 429 — the wrapped auth middleware runs next and returns .next()
      expect(response.status).not.toBe(429);
    });

    it("does not rate-limit GET on the credentials callback", async () => {
      const req = buildReq({
        path: "/api/auth/callback/credentials",
        method: "GET",
      });

      await proxy(req);

      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("does not rate-limit other paths", async () => {
      // Use /api/auth/csrf (not /api/auth/session) — session has its own
      // per-user limiter now, which would trip mockLimit.
      const req = buildReq({
        path: "/api/auth/csrf",
        method: "POST",
      });

      await proxy(req);

      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe("body-size cap", () => {
    it("returns 413 when POST content-length exceeds the cap", async () => {
      const req = buildReq({
        path: "/api/bookings",
        method: "POST",
        headers: { "content-length": "200000" },
      });

      const response = (await proxy(req)) as NextResponse;
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

      const response = (await proxy(req)) as NextResponse;

      expect(response.status).not.toBe(413);
    });

    it("ignores content-length on GET (never carries a body)", async () => {
      const req = buildReq({
        path: "/api/bookings",
        method: "GET",
        headers: { "content-length": "999999" },
      });

      const response = (await proxy(req)) as NextResponse;

      expect(response.status).not.toBe(413);
    });

    it("returns 411 when a POST omits Content-Length (chunked bypass)", async () => {
      // Bypass buildReq's default content-length by constructing the
      // request inline — this test is explicitly about the missing
      // header case.
      const req = {
        url: "http://localhost/api/bookings",
        method: "POST",
        headers: new Headers(),
        nextUrl: { pathname: "/api/bookings" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const response = (await proxy(req)) as NextResponse;
      const data = await response.json();

      expect(response.status).toBe(411);
      expect(data.error).toMatch(/content-length required/i);
      // Cap runs before the rate limiter
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe("per-user API rate limit", () => {
    it("returns 429 when the api limiter says the caller is over quota", async () => {
      mockGetToken.mockResolvedValue({ id: "user-abc" });
      mockLimit.mockResolvedValue({
        success: false,
        limit: 120,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const req = buildReq({ path: "/api/bookings", method: "GET" });
      const response = (await proxy(req)) as NextResponse;
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
      await proxy(req);

      // Falls back to `ip:<clientIp>` when no token — clientIp mocked to 203.0.113.7
      expect(mockLimit).toHaveBeenCalledWith("ip:203.0.113.7");
    });

    it("does not touch the api limiter for /api/auth/*", async () => {
      // Use /api/auth/csrf (not /api/auth/session) because the session
      // endpoint has its own per-user limiter which also reads the token.
      const req = buildReq({
        path: "/api/auth/csrf",
        method: "GET",
      });
      await proxy(req);

      // /api/auth/* skips the api limiter branch entirely
      expect(mockGetToken).not.toHaveBeenCalled();
    });

    it("does not touch the api limiter for non-API routes", async () => {
      const req = buildReq({
        path: "/bookings",
        method: "GET",
        token: { id: "u-1", role: "STAFF" },
      });
      await proxy(req);

      expect(mockGetToken).not.toHaveBeenCalled();
    });
  });

  describe("auth-endpoint rate limit", () => {
    const limitedRoutes = [
      { path: "/api/auth/reset-password", method: "POST" },
      { path: "/api/auth/setup-password", method: "POST" },
      { path: "/api/auth/invite/some-raw-token", method: "GET" },
    ];

    for (const { path, method } of limitedRoutes) {
      it(`returns 429 for ${method} ${path} when the auth-endpoint limiter reports success: false`, async () => {
        mockLimit.mockResolvedValue({
          success: false,
          limit: 10,
          remaining: 0,
          reset: Date.now() + 900_000,
        });

        const req = buildReq({ path, method });
        const response = (await proxy(req)) as NextResponse;
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toMatch(/too many requests/i);
        expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(mockLimit).toHaveBeenCalledWith("ip:203.0.113.7");
      });

      it(`passes ${method} ${path} through when the auth-endpoint limiter reports success: true`, async () => {
        mockLimit.mockResolvedValue({
          success: true,
          limit: 10,
          remaining: 9,
          reset: Date.now() + 900_000,
        });

        const req = buildReq({ path, method });
        const response = (await proxy(req)) as NextResponse;

        expect(response.status).not.toBe(429);
      });
    }

    it("does not rate-limit /api/auth/forgot-password (self-limits with dual key)", async () => {
      const req = buildReq({
        path: "/api/auth/forgot-password",
        method: "POST",
      });
      await proxy(req);

      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("does not rate-limit /api/auth/rate-limit-status (login-page UX pre-check)", async () => {
      const req = buildReq({
        path: "/api/auth/rate-limit-status",
        method: "GET",
      });
      await proxy(req);

      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("does not rate-limit NextAuth internals (/api/auth/csrf)", async () => {
      // /api/auth/session has its own per-user limiter (covered by the
      // 'session-endpoint rate limit' describe below); csrf and other
      // NextAuth internals remain unlimited by the auth-endpoint limiter.
      const req = buildReq({ path: "/api/auth/csrf", method: "GET" });
      await proxy(req);

      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("does not rate-limit non-auth API paths via the auth-endpoint limiter (that's the general api limiter's job)", async () => {
      mockGetToken.mockResolvedValue({ id: "user-abc" });
      mockLimit.mockResolvedValue({
        success: true,
        limit: 120,
        remaining: 119,
        reset: Date.now() + 60_000,
      });

      const req = buildReq({ path: "/api/bookings", method: "GET" });
      await proxy(req);

      // Only the general api limiter fires — one call, keyed by userId, not IP.
      expect(mockLimit).toHaveBeenCalledTimes(1);
      expect(mockLimit).toHaveBeenCalledWith("user-abc");
    });
  });

  describe("non-auth API paths skip withAuth", () => {
    // Non-auth API routes handle their own session check in the handler
    // (Rule 4). Middleware must NOT 302 unauthenticated API calls to /login.
    it("does not redirect unauthenticated /api/bookings", async () => {
      const req = buildReq({ path: "/api/bookings", token: null });

      const response = (await proxy(req)) as NextResponse;

      expect(response.headers.get("location")).toBeNull();
    });

    it("does not redirect unauthenticated /api/reports", async () => {
      const req = buildReq({ path: "/api/reports", token: null });

      const response = (await proxy(req)) as NextResponse;

      expect(response.headers.get("location")).toBeNull();
    });
  });

  describe("session-endpoint rate limit", () => {
    it("returns 429 when a signed-in user is over quota", async () => {
      mockGetToken.mockResolvedValue({ id: "user-abc" });
      mockLimit.mockResolvedValue({
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const req = buildReq({ path: "/api/auth/session", method: "GET" });
      const response = (await proxy(req)) as NextResponse;
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toMatch(/too many requests/i);
      // Per-user key
      expect(mockLimit).toHaveBeenCalledWith("user-abc");
    });

    it("keys on IP when the request is unauthenticated", async () => {
      mockGetToken.mockResolvedValue(null);
      mockLimit.mockResolvedValue({
        success: true,
        limit: 60,
        remaining: 59,
        reset: Date.now() + 60_000,
      });

      const req = buildReq({ path: "/api/auth/session", method: "GET" });
      await proxy(req);

      expect(mockLimit).toHaveBeenCalledWith("ip:203.0.113.7");
    });

    it("passes through when under quota", async () => {
      mockGetToken.mockResolvedValue({ id: "user-abc" });
      mockLimit.mockResolvedValue({
        success: true,
        limit: 60,
        remaining: 59,
        reset: Date.now() + 60_000,
      });

      const req = buildReq({ path: "/api/auth/session", method: "GET" });
      const response = (await proxy(req)) as NextResponse;

      // Not a 429; falls through to withAuth (mocked as passthrough)
      expect(response.status).not.toBe(429);
    });

    it("does not touch the session limiter for other /api/auth/* paths", async () => {
      const req = buildReq({ path: "/api/auth/csrf", method: "GET" });
      await proxy(req);

      // Session-endpoint middleware short-circuits on the exact path check
      // before calling getToken or the limiter.
      expect(mockGetToken).not.toHaveBeenCalled();
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });
});
