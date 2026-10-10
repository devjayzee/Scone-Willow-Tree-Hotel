import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { getToken, type JWT } from "next-auth/jwt";
import { getClientIp } from "@/lib/utils/get-client-ip";
import {
  getApiRateLimiter,
  getAuthEndpointRateLimiter,
  getLoginRateLimiter,
  getSessionEndpointRateLimiter,
} from "@/lib/services/rate-limit-service";
import { logger } from "@/lib/logger";

// Shared 429 response shape — every rate limiter reports the same
// {limit, remaining, reset} triple, surfaced as X-RateLimit-* headers.
function tooManyRequests(
  message: string,
  { limit, remaining, reset }: { limit: number; remaining: number; reset: number },
): NextResponse {
  return NextResponse.json(
    { error: message },
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

// Cap request bodies at ~100 KB. Every route validates fields via Zod (Rule
// 3), but a 100 MB payload still hits `request.json()` before validation
// fires — an attacker-controlled memory-pressure surface on the event loop.
// Vercel enforces 4.5 MB out of the box; this is defence-in-depth for
// self-hosted deployments.
const MAX_BODY_BYTES = 100_000;

// Auth pages reachable without a session; signed-in users get bounced to
// the dashboard from all of them unless ?session=expired is present (only
// requireSession sends it, always to /login; see the public-auth branch below).
const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/setup-password",
]);

// getToken() only decodes the JWE; it never runs the jwt callback, so a
// session that expired or was revoked still decodes with a real `id`.
// The expiry half of that check is copied here from the jwt callback in
// src/lib/auth.ts:120-123: only a numeric expiresAt can expire a token, a
// missing one falls through to NextAuth's own maxAge. Revocation
// (tokenVersion / isActive) needs a DB read and stays in requireSession.
function hasLiveSession(token: JWT | null): boolean {
  if (!token?.id) return false;
  return !(
    typeof token.expiresAt === "number" &&
    Math.floor(Date.now() / 1000) > token.expiresAt
  );
}

// Matches the production (__Secure-), development and chunked (.0, .1, ...)
// session cookie names.
const SESSION_COOKIE = /^(__Secure-)?next-auth\.session-token(\.\d+)?$/;

// Deletes every session cookie on the request. `secure` must match the
// cookie's own flag for __Secure- names or the browser drops the deletion.
function clearSessionCookies(req: NextRequest, res: NextResponse): void {
  for (const { name } of req.cookies.getAll()) {
    if (SESSION_COOKIE.test(name)) {
      res.cookies.delete({ name, path: "/", secure: name.startsWith("__Secure-") });
    }
  }
}

// Routes that require MANAGER or GENERAL_MANAGER role.
const MANAGER_PATHS = ["/reports"];

// Routes that require GENERAL_MANAGER role only. /rooms is GM-only
// because every mutation on the page (create/update/delete room) is
// gated to GM at the API. MANAGER/STAFF who need room data at
// runtime (booking form) use /api/rooms/available, which is open.
const GENERAL_MANAGER_ONLY_PATHS = ["/staff", "/rooms"];

function tooLarge(): NextResponse {
  return NextResponse.json(
    { error: "Request body too large" },
    { status: 413 },
  );
}

async function enforceBodySizeCap(
  req: NextRequest,
): Promise<NextResponse | null> {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    return null;
  }
  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    return Number(contentLength) > MAX_BODY_BYTES ? tooLarge() : null;
  }
  // No content-length does not mean no body: on Vercel a zero length never
  // reaches the proxy, and chunked/streamed bodies arrive with none. Measure
  // a clone instead of refusing; the clone keeps the proxy's request body
  // intact. Next.js already buffers the body for the proxy
  // (experimental.proxyClientMaxBodySize, 10 MB default), so this adds no
  // new unbounded read of bytes. Time is not capped: a slow client is held
  // until its body ends, as before.
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const body = req.clone().body;
    if (!body) return null;
    reader = body.getReader();
    // Next never ends or errors the body when the client drops mid-upload,
    // so a pending read() would wait forever; req.signal is the way out.
    const aborted = new Promise<"aborted">((resolve) => {
      onAbort = () => resolve("aborted");
      if (req.signal.aborted) onAbort();
      else req.signal.addEventListener("abort", onAbort, { once: true });
    });
    let total = 0;
    for (;;) {
      const result = await Promise.race([reader.read(), aborted]);
      if (result === "aborted") {
        abandonBody(reader, req);
        return invalidBody();
      }
      if (result.done) return null;
      total += result.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        abandonBody(reader, req);
        return tooLarge();
      }
    }
  } catch {
    // A stream error means the size can't be verified: fail closed.
    return invalidBody();
  } finally {
    if (onAbort) req.signal.removeEventListener("abort", onAbort);
  }
}

function invalidBody(): NextResponse {
  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

// Cancels the clone's reader and the original body without awaiting: once both
// branches are cancelled the tee cancels its source, and that waits on a read
// that never finishes if the client stalls or drops.
function abandonBody(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  req: NextRequest,
): void {
  reader.cancel().catch(() => {});
  req.body?.cancel().catch(() => {});
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

  return tooManyRequests("Too many requests. Please slow down.", {
    limit,
    remaining,
    reset,
  });
}

// Paths under /api/auth/** that we own and want IP-rate-limited.
// forgot-password self-limits (dual key needs the body); rate-limit-status
// is limited by getLoginPrecheckStatus in the rate-limit service, which
// answers a gate trip with 429; NextAuth internals and the credentials
// callback are handled elsewhere.
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

  return tooManyRequests("Too many requests. Please slow down.", {
    limit,
    remaining,
    reset,
  });
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

  return tooManyRequests("Too many requests. Please slow down.", result);
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
        return tooManyRequests("Too many login attempts. Please try again later.", {
          limit,
          remaining,
          reset,
        });
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

    // Public auth pages. A dead session (expired, nulled `id`, or an
    // undecodable cookie) renders the page and has its cookies cleared, so a
    // stale cookie cannot loop /login -> /bookings -> /login. A live session
    // is bounced to the dashboard, unless requireSession just sent it here
    // with ?session=expired (revoked sessions look live to the proxy). The
    // parameter never adds or suppresses a cookie deletion.
    if (PUBLIC_AUTH_PATHS.has(path)) {
      if (!hasLiveSession(token)) {
        const res = NextResponse.next();
        clearSessionCookies(req, res);
        return res;
      }
      if (req.nextUrl.searchParams.get("session") !== "expired") {
        return NextResponse.redirect(new URL("/bookings", req.url));
      }
      return NextResponse.next();
    }

    if (MANAGER_PATHS.some((p) => path.startsWith(p))) {
      if (token?.role !== "GENERAL_MANAGER" && token?.role !== "MANAGER") {
        return NextResponse.redirect(new URL("/bookings", req.url));
      }
    }

    if (GENERAL_MANAGER_ONLY_PATHS.some((p) => path.startsWith(p))) {
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
        // Require a live session — see hasLiveSession for what the proxy
        // can and cannot tell from the cookie.
        return hasLiveSession(token);
      },
    },
  }
);

// Combined middleware
export default async function proxy(req: NextRequest) {
  // Body-size cap runs before anything else so an oversized payload never
  // touches auth, rate limiting, or the route handler.
  const oversized = await enforceBodySizeCap(req);
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
