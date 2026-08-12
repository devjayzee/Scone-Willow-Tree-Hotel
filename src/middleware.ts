import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { getToken } from "next-auth/jwt";
import { getClientIp } from "@/lib/utils/get-client-ip";
import {
  getApiRateLimiter,
  getAuthEndpointRateLimiter,
  getLoginRateLimiter,
} from "@/lib/services/rate-limit-service";
import { buildCsp } from "@/lib/security/csp";

// Cap request bodies at ~100 KB. Every route validates fields via Zod (Rule
// 3), but a 100 MB payload still hits `request.json()` before validation
// fires — an attacker-controlled memory-pressure surface on the event loop.
// Vercel enforces 4.5 MB out of the box; this is defence-in-depth for
// self-hosted deployments (#117).
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
  // entirely (#188). Force clients to declare a length so the cap
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
 * Rate-limit non-auth /api/* routes (#116). Keyed per authenticated user
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

// Paths under /api/auth/** that we own and want IP-rate-limited (#140).
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

    // Redirect authenticated users away from the public auth pages
    if (PUBLIC_AUTH_PATHS.has(path) && token) {
      return NextResponse.redirect(new URL("/bookings", req.url));
    }

    // Routes that require MANAGER or GENERAL_MANAGER role
    const managerPaths = ["/rooms", "/reports"];
    if (managerPaths.some((p) => path.startsWith(p))) {
      if (token?.role !== "GENERAL_MANAGER" && token?.role !== "MANAGER") {
        return NextResponse.redirect(new URL("/bookings", req.url));
      }
    }

    // Routes that require GENERAL_MANAGER role only
    const generalManagerOnlyPaths = ["/staff"];
    if (generalManagerOnlyPaths.some((p) => path.startsWith(p))) {
      if (token?.role !== "GENERAL_MANAGER") {
        return NextResponse.redirect(new URL("/bookings", req.url));
      }
    }

    // Fall through — the outer middleware owns the propagating
    // response (with the cloned x-nonce headers). withAuth v4
    // swallows a `NextResponse.next({ request: { headers } })`
    // returned from here (next-auth issue #8023), so nonce propagation
    // has to happen outside this wrapper. Returning undefined here
    // means withAuth's own default `NextResponse.next()` fires — we
    // discard that below and rebuild the response ourselves.
    return undefined;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Allow access to public auth pages and auth API without token
        if (PUBLIC_AUTH_PATHS.has(path) || path.startsWith("/api/auth/")) {
          return true;
        }
        // Require token for all other matched routes
        return !!token;
      },
    },
  }
);

// Combined middleware
export default async function middleware(req: NextRequest) {
  // Body-size cap runs before anything else so an oversized payload never
  // touches auth, rate limiting, or the route handler.
  const oversized = enforceBodySizeCap(req);
  if (oversized) return oversized;

  // Check rate limiting first for auth endpoints
  const rateLimitResponse = await rateLimitMiddleware(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // IP-keyed limit on the reset/setup/invite auth endpoints (#140)
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

  // Per-request CSP nonce (#141). Next reads the nonce from the
  // request's `x-nonce` header when emitting <script> tags — with
  // strict-dynamic on, chunk scripts without a nonce get blocked.
  //
  // TWO subtleties that took a rebase to figure out (see PR #216):
  //
  // 1. `NextResponse.next({ request: { headers } })` requires a NEW
  //    Headers instance. Mutating req.headers in place and passing
  //    the reference puts Next's internal request-context builder
  //    into an inconsistent state → runtime TypeError when a page
  //    later renders dynamically.
  //
  // 2. next-auth v4's withAuth wrapper SWALLOWS a `NextResponse.next({
  //    request })` returned from its inner middleware (issue #8023).
  //    So we can't propagate x-nonce through it. Workaround: run
  //    withAuth for its side effect (redirects on auth failure /
  //    role mismatch), then build the pass-through response OURSELVES
  //    from the outer middleware with the cloned headers.
  //
  // The 411/413/429 early returns above skip CSP entirely; they emit
  // JSON and browsers don't apply CSP to JSON meaningfully.
  const nonce = crypto.randomUUID();
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  let response: NextResponse;

  // Non-auth API routes handle their own session check in the route handler
  // (Rule 4). Running withAuth here would 302-redirect unauthenticated API
  // calls to /login instead of returning a JSON 401.
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/") && !path.startsWith("/api/auth/")) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    // withAuth expects NextRequestWithAuth + NextFetchEvent, but we don't
    // have a real NextFetchEvent at this call site — NextAuth treats {} as
    // a stub. @ts-expect-error fails loudly if the upstream typing gap ever
    // closes, forcing us to revisit this shim.
    // @ts-expect-error next-auth/middleware withAuth typing gap
    const authResponse = (await authMiddleware(req, {} as NextFetchEvent)) as
      | NextResponse
      | undefined;

    // withAuth returns a redirect on auth failure / role mismatch —
    // honour it. Otherwise ignore withAuth's default next() response
    // (see subtlety #2 above) and build our own with x-nonce.
    if (
      authResponse &&
      authResponse.status >= 300 &&
      authResponse.status < 400
    ) {
      response = authResponse;
    } else {
      response = NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/setup-password",
    // Match all API routes (not just /api/auth/*) so the body-size cap
    // above fires for /api/bookings, /api/staffs, etc. Non-auth API paths
    // skip withAuth via the branch in `middleware()` above.
    "/api/:path*",
    "/bookings/:path*",
    "/rooms/:path*",
    "/calendar/:path*",
    "/reports/:path*",
    "/staff/:path*",
  ],
};
