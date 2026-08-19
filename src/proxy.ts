import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { getToken } from "next-auth/jwt";
import { getClientIp } from "@/lib/utils/get-client-ip";
import {
  getApiRateLimiter,
  getAuthEndpointRateLimiter,
  getLoginRateLimiter,
  getSessionEndpointRateLimiter,
} from "@/lib/services/rate-limit-service";
import { logger } from "@/lib/logger";

// Cap request bodies at ~100 KB. Every route validates fields via Zod (Rule
// 3), but a 100 MB payload still hits `request.json()` before validation
// fires — an attacker-controlled memory-pressure surface on the event loop.
// Vercel enforces 4.5 MB out of the box; this is defence-in-depth for
// self-hosted deployments.
const MAX_BODY_BYTES = 100_000;

// Auth pages reachable without a session; signed-in users get bounced to
// the dashboard from all of them.
const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/setup-password",
]);

function enforceBodySizeCap(req: NextRequest): NextResponse | null {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    return null;
  }
  const contentLength = req.headers.get("content-length");
  // Missing content-length on a body-carrying method typically means
  // Transfer-Encoding: chunked, which sidesteps the size check
  // entirely. Force clients to declare a length so the cap
  // applies uniformly. Vercel's 4.5 MB cap is still the real backstop.
  if (contentLength === null) {
    return NextResponse.json(
      { error: "Content-Length required" },
      { status: 411 },
    );
  }
  if (Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 },
    );
  }
  return null;
}

/**
 * Rate-limit non-auth /api/* routes. Keyed per authenticated user
 * (userId from the JWT); falls back to client IP when there's no token
 * (rare — those routes reject via getServerSession before doing real
 * work, but the limiter still protects against unauthenticated flood).
 */
async function apiRateLimitMiddleware(
  req: NextRequest,
): Promise<NextResponse | null> {
  const path = req.nextUrl.pathname;
  if (!path.startsWith("/api/") || path.startsWith("/api/auth/")) {
    return null;
  }

  const limiter = getApiRateLimiter();
  if (!limiter) return null;

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const key = (token?.id as string | undefined) ?? `ip:${getClientIp(req)}`;

  const { success, limit, remaining, reset } = await limiter.limit(key);
  if (success) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    },
  );
}

// Paths under /api/auth/** that we own and want IP-rate-limited.
// forgot-password self-limits (dual key needs the body); rate-limit-status
// is a UX pre-check called ~2x per login attempt and intentionally left
// unlimited; NextAuth internals and the credentials callback are handled
// elsewhere.
const AUTH_ENDPOINT_LIMITED_EXACT = new Set([
  "/api/auth/reset-password",
  "/api/auth/setup-password",
]);

function isAuthEndpointLimited(path: string): boolean {
  return (
    AUTH_ENDPOINT_LIMITED_EXACT.has(path) ||
    path.startsWith("/api/auth/invite/")
  );
}

async function authEndpointRateLimitMiddleware(
  req: NextRequest,
): Promise<NextResponse | null> {
  if (!isAuthEndpointLimited(req.nextUrl.pathname)) return null;

  const limiter = getAuthEndpointRateLimiter();
  if (!limiter) return null;

  const { success, limit, remaining, reset } = await limiter.limit(
    `ip:${getClientIp(req)}`,
  );
  if (success) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    },
  );
}

/**
 * Per-user rate limit on `/api/auth/session`. That endpoint runs a
 * prisma.user.findUnique on every call and the session provider polls
 * every 60s; unbounded, any signed-in client can drive DB reads at
 * will. Per-user key with an IP fallback for the rare unauthenticated
 * caller, matching the pattern in `apiRateLimitMiddleware`.
 */
async function sessionEndpointRateLimitMiddleware(
  req: NextRequest,
): Promise<NextResponse | null> {
  if (req.nextUrl.pathname !== "/api/auth/session") return null;

  const limiter = getSessionEndpointRateLimiter();
  if (!limiter) return null;

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const key = (token?.id as string | undefined) ?? `ip:${getClientIp(req)}`;

  // Fail open on Upstash transport errors. Session polling should never
  // 500 the app (the session provider surfaces any non-JSON response as
  // a CLIENT_FETCH_ERROR in the browser console, breaking smoke tests
  // and hydration). The underlying protection — the DB read in the jwt
  // callback — still runs and still requires a valid token; skipping
  // this cap during an Upstash outage is strictly less protective, not
  // a bypass.
  let result;
  try {
    result = await limiter.limit(key);
  } catch (err) {
    logger.warn("session-endpoint rate limiter unreachable — failing open", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (result.success) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.reset.toString(),
      },
    },
  );
}

// Rate limiting middleware for auth endpoints
async function rateLimitMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const path = req.nextUrl.pathname;

  // Only rate limit POST to credentials callback
  if (path === "/api/auth/callback/credentials" && req.method === "POST") {
    const rateLimiter = getLoginRateLimiter();

    if (rateLimiter) {
      const ip = getClientIp(req);
      const { success, limit, reset, remaining } = await rateLimiter.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many login attempts. Please try again later." },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }
        );
      }
    }
  }

  return null; // Continue to next middleware
}

// Auth middleware using withAuth
const authMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Redirect authenticated users away from the public auth pages.
    // Check `token.id` not `token` — auth.ts's jwt callback returns
    // `{ ...token, id: null }` on invalidation (expiry, tokenVersion
    // bump, deactivation) and NextAuth re-encodes that nulled shape
    // back to the cookie. `!!token` is truthy for the nulled shape,
    // which used to loop: middleware would send an invalidated user
    // from /login → /bookings → requireSession redirects to /login →
    // repeat. Requiring token.id breaks the loop.
    if (PUBLIC_AUTH_PATHS.has(path) && token?.id) {
      return NextResponse.redirect(new URL("/bookings", req.url));
    }

    // Routes that require MANAGER or GENERAL_MANAGER role
    const managerPaths = ["/reports"];
    if (managerPaths.some((p) => path.startsWith(p))) {
      if (token?.role !== "GENERAL_MANAGER" && token?.role !== "MANAGER") {
        return NextResponse.redirect(new URL("/bookings", req.url));
      }
    }

    // Routes that require GENERAL_MANAGER role only. /rooms is GM-only
    // because every mutation on the page (create/update/delete room) is
    // gated to GM at the API. MANAGER/STAFF who need room data at
    // runtime (booking form) use /api/rooms/available, which is open.
    const generalManagerOnlyPaths = ["/staff", "/rooms"];
    if (generalManagerOnlyPaths.some((p) => path.startsWith(p))) {
      if (token?.role !== "GENERAL_MANAGER") {
        return NextResponse.redirect(new URL("/bookings", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Allow access to public auth pages and auth API without token
        if (PUBLIC_AUTH_PATHS.has(path) || path.startsWith("/api/auth/")) {
          return true;
        }
        // Require a valid token (with id) — see the comment on the
        // /login redirect above for the invalidated-token loop this
        // guards against.
        return !!token?.id;
      },
    },
  }
);

// Combined middleware
export default async function proxy(req: NextRequest) {
  // Body-size cap runs before anything else so an oversized payload never
  // touches auth, rate limiting, or the route handler.
  const oversized = enforceBodySizeCap(req);
  if (oversized) return oversized;

  // Check rate limiting first for auth endpoints
  const rateLimitResponse = await rateLimitMiddleware(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Per-user cap on /api/auth/session (NextAuth's session poll endpoint
  // hits Prisma every call; must run before apiRateLimitMiddleware's
  // /api/auth/** short-circuit).
  const sessionEndpointRateLimitResponse =
    await sessionEndpointRateLimitMiddleware(req);
  if (sessionEndpointRateLimitResponse) {
    return sessionEndpointRateLimitResponse;
  }

  // IP-keyed limit on the reset/setup/invite auth endpoints
  const authEndpointRateLimitResponse =
    await authEndpointRateLimitMiddleware(req);
  if (authEndpointRateLimitResponse) {
    return authEndpointRateLimitResponse;
  }

  // Per-user API rate limit on non-auth /api/* routes
  const apiRateLimitResponse = await apiRateLimitMiddleware(req);
  if (apiRateLimitResponse) {
    return apiRateLimitResponse;
  }

  // Non-auth API routes handle their own session check in the route handler
  // (Rule 4). Running withAuth here would 302-redirect unauthenticated API
  // calls to /login instead of returning a JSON 401.
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/") && !path.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // withAuth expects NextRequestWithAuth + NextFetchEvent, but we don't
  // have a real NextFetchEvent at this call site — NextAuth treats {} as
  // a stub. @ts-expect-error fails loudly if the upstream typing gap ever
  // closes, forcing us to revisit this shim.
  // @ts-expect-error next-auth/middleware withAuth typing gap
  return authMiddleware(req, {} as NextFetchEvent);
}

export const config = {
  matcher: [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/setup-password",
    // Match all API routes (not just /api/auth/*) so the body-size cap
    // above fires for /api/bookings, /api/staffs, etc. Non-auth API paths
    // skip withAuth via the early return in `proxy()` at the top of this
    // file.
    "/api/:path*",
    "/bookings/:path*",
    "/rooms/:path*",
    "/calendar/:path*",
    "/reports/:path*",
    "/staff/:path*",
  ],
};
