import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getClientIp } from "@/lib/utils/get-client-ip";

export async function GET(req: NextRequest) {
  // Check if Upstash is configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return NextResponse.json({ limited: false, remaining: 999 });
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    analytics: true,
    prefix: "ratelimit:login",
  });

  const ip = getClientIp(req);

  // Get current status without consuming a token
  const { remaining, reset } = await rateLimiter.getRemaining(ip);

  return NextResponse.json({
    limited: remaining === 0,
    remaining,
    resetAt: reset,
  });
}
