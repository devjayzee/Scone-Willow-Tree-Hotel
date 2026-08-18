import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { LoginRateLimitStatus } from "@/types/auth";

// Fail loud at server boot when Upstash is unconfigured in production.
// Without this guard the factories below silently return null and every
// call site treats null as "skip", leaving login / API / forgot-password
// endpoints with no rate limiting at all — a documented default that
// invited unlimited online password guessing. Dev workflows are
// unchanged: Upstash stays optional locally.
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN)
) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.",
  );
}

/**
 * Per-process singleton factories for Upstash-backed rate limiters. Vercel
 * edge + serverless runtimes each get their own module graph — instances are
 * not shared across runtimes. That's fine: state lives in Redis, and both
 * callers (middleware gate and status route pre-check) build their limiter
 * from the same source config.
 *
 * All four limiters share the same env vars and the same shape (env check
 * → new Redis → new Ratelimit); the extracted `makeRateLimiter` closure
 * captures the per-config memo. Callers still get null when Upstash is
 * unconfigured, which they already handle as "rate limiting disabled".
 */
function makeRateLimiter(config: {
  limiter: ReturnType<typeof Ratelimit.slidingWindow>;
  prefix: string;
}): () => Ratelimit | null {
  let instance: Ratelimit | null = null;
  return () => {
    if (
      !instance &&
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      instance = new Ratelimit({
        redis,
        limiter: config.limiter,
        analytics: true,
        prefix: config.prefix,
      });
    }
    return instance;
  };
}

/** Shared IP-keyed login rate limiter (5 attempts / 15 min). */
export const getLoginRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "ratelimit:login",
});

/**
 * Per-user (or per-IP fallback) limiter for non-auth /api/* routes.
 * Bucket: 120 requests / 1-minute sliding window — bursty operator UX (a
 * dashboard load fires ~5 parallel calls) fits under this ceiling; sustained
 * abuse gets throttled.
 */
export const getApiRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(120, "1 m"),
  prefix: "ratelimit:api",
});

/**
 * Limiter for the public forgot-password endpoint. Callers consume with
 * `.limit()` on TWO keys per request — `ip:<clientIp>` and
 * `email:<lowercased>` — and treat failure on either as a throttle. Keying
 * by both stops one IP from spraying many emails and many IPs from
 * hammering one email. Bucket: 3 / 15 min per key.
 */
export const getForgotPasswordRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(3, "15 m"),
  prefix: "ratelimit:forgot-password",
});

/**
 * IP-keyed limiter for reset-password / setup-password / invite/[token].
 * Bucket: 10 / 15 min. Excludes forgot-password (self-limits with
 * dual-key trick) and rate-limit-status (called twice per login attempt as
 * UX sugar — would 429 users mid-troubleshoot). Defense-in-depth: tokens
 * are 43-char base64url (~256 bits), so this is CPU/log-spam protection,
 * not the primary boundary.
 */
export const getAuthEndpointRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  prefix: "ratelimit:auth-endpoint",
});

/**
 * Per-user limiter for `POST /api/staffs`. Bucket: 5 / 1 h. The
 * generic apiRateLimiter (120 / 1 min) is too loose here because a
 * compromised GM account can spray outbound invites from the verified
 * Resend domain. 5 / hour is enough for a normal hiring push and low
 * enough to blunt an abuse burst even before the recipient-domain
 * allowlist kicks in.
 */
export const getStaffInviteRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:staff-invite",
});

/**
 * IP-keyed cap on the public `GET /api/auth/rate-limit-status` endpoint.
 * Bucket: 60 / 1 min — generous enough for the login page's
 * ~2 pre-checks per attempt without any UX hit, but enough to blunt a
 * flood that would otherwise burn Upstash quota. Enforced softly: on
 * denial the route returns the same `LoginRateLimitStatus` shape it
 * would on a real login-limit hit, so the pre-check UI doesn't break.
 */
export const getRateLimitStatusLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "ratelimit:rate-limit-status",
});

/**
 * Per-user limiter for `/api/auth/session`. NextAuth hits
 * `prisma.user.findUnique` on every call and the session provider polls
 * at refetchInterval=60s, so an unlimited endpoint means any signed-in
 * client can drive unbounded DB reads by opening a script or many tabs.
 * Bucket: 60 / 1 min per user — allows ~60 tabs polling every 60s
 * comfortably, throttles scripted floods at 1/s.
 */
export const getSessionEndpointRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "ratelimit:session-endpoint",
});

export type { LoginRateLimitStatus };

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
