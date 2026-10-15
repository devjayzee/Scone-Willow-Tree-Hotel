import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { LoginRateLimitStatus } from "@/types/auth";
import {
  DEVICE_REVOCATION_READ_TIMEOUT_MS,
  DEVICE_REVOCATION_TTL,
  SESSION_ENDPOINT_LIMIT_PER_MINUTE,
} from "@/lib/constants/auth";
import { normalizeEmail } from "@/lib/validations/email";
import { RateLimitError } from "@/lib/errors";

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

/** Shared Redis client; null when Upstash is unconfigured. */
let redisClient: Redis | null = null;
function getRedis(): Redis | null {
  if (
    !redisClient &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisClient;
}

/**
 * Per-process singleton factories for Upstash-backed rate limiters. Vercel
 * edge + serverless runtimes each get their own module graph — instances are
 * not shared across runtimes. That's fine: state lives in Redis, and every
 * caller builds its limiter from the same source config. The login limiters
 * (IP, email, trusted) are spent by `consumeLoginAttempt` inside `authorize`;
 * the status route pre-check only reads them.
 *
 * Every limiter below shares the same env vars and the same shape (shared
 * `getRedis()` client → new Ratelimit); the extracted `makeRateLimiter`
 * closure captures the per-config memo. Callers still get null when Upstash is
 * unconfigured, which they already handle as "rate limiting disabled".
 */
function makeRateLimiter(config: {
  limiter: ReturnType<typeof Ratelimit.slidingWindow>;
  prefix: string;
}): () => Ratelimit | null {
  let instance: Ratelimit | null = null;
  return () => {
    const redis = !instance ? getRedis() : null;
    if (redis) {
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
 * Per-email login rate limiter, used inside `authorize()`. Complements
 * the IP-keyed `getLoginRateLimiter` so that distributed brute-force
 * attempts (many IPs, one account) still hit a per-account cap.
 * Bucket: 10 / 15 min.
 */
export const getLoginEmailRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  prefix: "ratelimit:login-email",
});

/**
 * Trusted-device login limiter, used inside `authorize()` for browsers
 * holding a valid trusted-device cookie. Key: the normalized email alone, so
 * one shared bucket per account caps every trusted device for that email
 * together, separate from the IP and email buckets. With the untrusted path,
 * one account gets at most 10 trusted plus 10 untrusted password checks per
 * 15 min. Bucket: 10 / 15 min.
 */
export const getLoginTrustedRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  prefix: "ratelimit:login-trusted",
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
 * Per-GM limiter shared by invite create and resend
 * (`staff-invites.ts`) and by staff email changes (`staff-mutations.ts`).
 * Bucket: 5 / 1 h. The generic apiRateLimiter (120 / 1 min) is too loose
 * here because a compromised GM account can spray outbound invites from the
 * verified Resend domain. 5 / hour is enough for a normal hiring push and low
 * enough to blunt an abuse burst even before the recipient-domain
 * allowlist kicks in.
 */
export const getStaffInviteRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:staff-invite",
});

/**
 * Deployment-wide cap on the same spends as `getStaffInviteRateLimiter`,
 * keyed by a single "global" bucket. Bucket: 20 / 1 h. The per-GM limiter
 * alone lets a stolen GM credential invite new GMs, each with its own
 * budget; this cap bounds the total outbound mail regardless of who spends.
 */
export const getStaffInviteGlobalRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(20, "1 h"),
  prefix: "ratelimit:staff-invite-global",
});

/**
 * IP-keyed cap on the public `GET /api/auth/rate-limit-status` endpoint.
 * Bucket: 60 / 1 min — generous enough for the login page's
 * ~2 pre-checks per attempt without any UX hit, but enough to blunt a
 * flood that would otherwise burn Upstash quota. On denial the route
 * answers 429 (see `getLoginPrecheckStatus`), never a fake lockout.
 */
export const getRateLimitStatusLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "ratelimit:rate-limit-status",
});

/**
 * Limiter for `/api/auth/session`. NextAuth hits `prisma.user.findUnique`
 * on every call, so an unlimited endpoint lets any signed-in client drive
 * unbounded DB reads. Bucket: 180 / 1 min per live session identity (keyed
 * in `src/proxy.ts`), sized for the multi-tab poll and focus fan-out; see
 * the budget note on SESSION_POLL_INTERVAL_SECONDS. Scripted floods are
 * still throttled at 3/s.
 */
export const getSessionEndpointRateLimiter = makeRateLimiter({
  limiter: Ratelimit.slidingWindow(SESSION_ENDPOINT_LIMIT_PER_MINUTE, "1 m"),
  prefix: "ratelimit:session-endpoint",
});

export type { LoginRateLimitStatus };

const validAfterKey = (email: string) => `trusted-device:valid-after:${email}`;

/**
 * Whether a verified trusted-device entry (issued at `deviceIat`) is still
 * valid: the valid-after key is absent or older than the entry. One GET. An
 * unparsable value counts as everything revoked, and a GET error fails
 * closed (untrusted path), never throws.
 */
async function isDeviceCurrent(email: string, deviceIat: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("valid-after read timed out")),
        DEVICE_REVOCATION_READ_TIMEOUT_MS,
      );
    });
    const raw = await Promise.race([
      redis.get<unknown>(validAfterKey(email)),
      timeout,
    ]);
    if (raw === null || raw === undefined) return true;
    let validAfter: number;
    if (typeof raw === "number" && Number.isFinite(raw)) validAfter = raw;
    else if (typeof raw === "string" && /^\d+$/.test(raw)) validAfter = Number(raw);
    else return false;
    return deviceIat > validAfter;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Marks every trusted-device entry for `email` issued up to now as revoked
 * (the key holds Unix seconds; `isDeviceCurrent` compares entries against it).
 * Callers run it BEFORE the database write it guards: a Redis error
 * propagates, so the write never happens. Returns the second written, or
 * null (no-op) when Upstash is unset.
 */
export async function revokeTrustedDevices(
  email: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  await redis.set(validAfterKey(normalizeEmail(email)), nowSec, {
    ex: DEVICE_REVOCATION_TTL,
  });
  return nowSec;
}

/**
 * Spends one login attempt; returns false when the attempt is refused.
 * - trusted (deviceIat set and newer than the email's valid-after key, or the
 *   key absent): the shared trusted bucket only (key = email, not the nonce),
 *   never the IP or email bucket. One bucket per account caps every trusted
 *   device for that email together, so one account gets at most 10 trusted
 *   plus 10 untrusted password checks per 15 min.
 * - untrusted (no entry, or an entry revoked by a password write,
 *   deactivation or email change): IP bucket (`ratelimit:login`, key = ip, so
 *   the pre-check keeps reading it); if refused, return false WITHOUT
 *   spending the email bucket; otherwise the email bucket.
 * - a null limiter (Upstash unset in dev) skips that check.
 */
export async function consumeLoginAttempt(input: {
  email: string;
  ip: string;
  deviceIat: number | null;
}): Promise<boolean> {
  if (
    input.deviceIat !== null &&
    (await isDeviceCurrent(input.email, input.deviceIat))
  ) {
    const trusted = getLoginTrustedRateLimiter();
    if (!trusted) return true;
    const { success } = await trusted.limit(input.email);
    return success;
  }

  const ipLimiter = getLoginRateLimiter();
  if (ipLimiter) {
    const { success } = await ipLimiter.limit(input.ip);
    if (!success) return false;
  }
  const emailLimiter = getLoginEmailRateLimiter();
  if (emailLimiter) {
    const { success } = await emailLimiter.limit(input.email);
    if (!success) return false;
  }
  return true;
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

/**
 * Login-page pre-check behind `GET /api/auth/rate-limit-status`. Read-only:
 * it does not consume a login token. The status-endpoint gate (60 / 1 min per
 * IP) stops a flood from burning Upstash quota; a trip throws `RateLimitError`
 * (429) rather than a fake "limited" status, so the login form can tell
 * "unknown" from a real lockout (ADR-008). `hasDeviceCookie` means the
 * client skips the IP bucket, so it gets the "not applicable" sentinel
 * (`{ limited: false, remaining: 999, resetAt: 0 }`) without reading it. The
 * cookie is not verified here, nor checked for revocation, so `authorize`
 * may still pause the attempt.
 */
export async function getLoginPrecheckStatus(
  ip: string,
  hasDeviceCookie = false,
): Promise<LoginRateLimitStatus> {
  const gate = getRateLimitStatusLimiter();
  if (gate) {
    const { success } = await gate.limit(ip);
    if (!success) {
      throw new RateLimitError("Too many requests. Try again shortly.");
    }
  }
  if (hasDeviceCookie) {
    return { limited: false, remaining: 999, resetAt: 0 };
  }
  return getLoginRateLimitStatus(ip);
}
