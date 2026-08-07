import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { getClientIp } from "@/lib/utils/get-client-ip";
import { getLoginRateLimiter } from "@/lib/services/rate-limit-service";

// Cap request bodies at ~100 KB. Every route validates fields via Zod (Rule
// 3), but a 100 MB payload still hits `request.json()` before validation
// fires — an attacker-controlled memory-pressure surface on the event loop.
// Vercel enforces 4.5 MB out of the box; this is defence-in-depth for
// self-hosted deployments (#117).
const MAX_BODY_BYTES = 100_000;

function enforceBodySizeCap(req: NextRequest): NextResponse | null {
  if (req.method === "GET" || req.method === "HEAD") return null;
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 },
    );
  }
  return null;
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

    // Redirect authenticated users away from login page
    if (path === "/login" && token) {
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

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Allow access to login page and auth API without token
        if (path === "/login" || path.startsWith("/api/auth/")) {
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
