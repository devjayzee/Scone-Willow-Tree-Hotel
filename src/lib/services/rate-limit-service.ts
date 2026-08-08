import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Per-process singleton. Vercel edge + serverless runtimes each get their
// own module graph — this instance is not shared across runtimes. That's
// fine: state lives in Redis, and both callers (middleware gate and status
// route pre-check) now build their limiter from the same source config,
// which is the point of the extraction.
let loginRateLimiter: Ratelimit | null = null;

/**
 * Shared IP-keyed login rate limiter (5 attempts / 15 min).
 * Returns null when Upstash env vars are missing — both callers already
 * handle the null case as "rate limiting disabled".
 */
export function getLoginRateLimiter(): Ratelimit | null {
  if (
    !loginRateLimiter &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    loginRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: true,
      prefix: "ratelimit:login",
    });
  }
  return loginRateLimiter;
}

let apiRateLimiter: Ratelimit | null = null;

/**
 * Per-user (or per-IP fallback) API rate limiter for non-auth /api/*
 * routes (#116). Prevents a compromised or malicious authenticated token
 * from enumerating or exhausting server resources at will.
 *
 * Bucket: 120 requests per 1-minute sliding window. Bursty operator
 * usage (loading a dashboard page kicks off ~5 parallel API calls) fits
 * comfortably under this ceiling; sustained abuse gets throttled. Adjust
 * if real traffic patterns push against it.
 *
 * Returns null when Upstash env vars are missing — caller treats that
 * as "rate limiting disabled".
 */
export function getApiRateLimiter(): Ratelimit | null {
  if (
    !apiRateLimiter &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    apiRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, "1 m"),
      analytics: true,
      prefix: "ratelimit:api",
    });
  }
  return apiRateLimiter;
}

let forgotPasswordRateLimiter: Ratelimit | null = null;

/**
 * Limiter for the public forgot-password endpoint. Unlike the login
 * limiter's read-only status check, callers consume with `.limit()` on
 * TWO keys per request — `ip:<clientIp>` and `email:<lowercased>` — and
 * treat failure on either as a throttle. Keying by both stops one IP
 * from spraying many emails and many IPs from hammering one email.
 *
 * Bucket: 3 requests / 15 min per key. Returns null when Upstash env
 * vars are missing — caller treats that as "rate limiting disabled".
 */
export function getForgotPasswordRateLimiter(): Ratelimit | null {
  if (
    !forgotPasswordRateLimiter &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    forgotPasswordRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "15 m"),
      analytics: true,
      prefix: "ratelimit:forgot-password",
    });
  }
  return forgotPasswordRateLimiter;
}

export interface LoginRateLimitStatus {
  limited: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Read-only status check for the login-page pre-check. Does NOT consume a
 * token (uses `getRemaining`, not `limit`). When Upstash is unconfigured
 * returns the historical sentinel from the old inline route (limited: false,
 * remaining: 999); resetAt: 0 makes "limiter disabled" observable to any
 * future consumer that inspects the field.
 */
export async function getLoginRateLimitStatus(
  ip: string,
): Promise<LoginRateLimitStatus> {
  const limiter = getLoginRateLimiter();
  if (!limiter) {
    return { limited: false, remaining: 999, resetAt: 0 };
  }
  const { remaining, reset } = await limiter.getRemaining(ip);
  return { limited: remaining === 0, remaining, resetAt: reset };
}
