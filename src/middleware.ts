import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { getClientIp } from "@/lib/utils/get-client-ip";
import { getLoginRateLimiter } from "@/lib/services/rate-limit-service";

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
  // Check rate limiting first for auth endpoints
  const rateLimitResponse = await rateLimitMiddleware(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
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
    "/api/auth/:path*",
    "/bookings/:path*",
    "/rooms/:path*",
    "/calendar/:path*",
    "/reports/:path*",
    "/staff/:path*",
  ],
};
