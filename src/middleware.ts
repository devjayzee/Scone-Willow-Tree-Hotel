import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getClientIp } from "@/lib/utils/get-client-ip";

// Initialize rate limiter (lazy to handle missing env vars gracefully)
let loginRateLimiter: Ratelimit | null = null;

function getRateLimiter() {
  if (!loginRateLimiter && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    loginRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 attempts per 15 minutes
      analytics: true,
      prefix: "ratelimit:login",
    });
  }
  return loginRateLimiter;
}

// Rate limiting middleware for auth endpoints
async function rateLimitMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const path = req.nextUrl.pathname;

  // Only rate limit POST to credentials callback
  if (path === "/api/auth/callback/credentials" && req.method === "POST") {
    const rateLimiter = getRateLimiter();

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

  // Then run auth middleware. withAuth's return type expects
  // NextRequestWithAuth + NextFetchEvent, but we don't have a real
  // NextFetchEvent at this call site — {} is treated as a stub by NextAuth.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextAuth withAuth types don't line up cleanly with the outer middleware wrapper
  return authMiddleware(req as any, {} as any);
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
