/**
 * Trusted-device cookie (server-only). Lets a staff member sign in from a
 * browser they have used before while a per-email login lockout is active.
 *
 * Format
 * - Value: up to DEVICE_COOKIE_MAX_ENTRIES entries, newest first, joined by
 *   `~`. Each entry is `<nonce>.<iat>.<sig>`.
 *   - nonce: 16 random bytes, base64url.
 *   - iat: Unix seconds.
 *   - sig: base64url HMAC-SHA256(key, `wt-device.v1|<normalizedEmail>|<nonce>|<iat>`).
 *   - The email itself is never stored in the cookie.
 * - Key: hkdfSync("sha256", NEXTAUTH_SECRET, "", "wt-device-cookie-v1", 32).
 *   Rotating NEXTAUTH_SECRET revokes every device.
 * - A valid entry: the signature matches (compared with timingSafeEqual),
 *   iat <= now + 60, and now - iat <= DEVICE_COOKIE_MAX_AGE.
 * - Input caps: the value is capped at 2048 chars and at most 10 entries are
 *   parsed. Anything malformed counts as "no trusted device".
 */
import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import {
  DEVICE_COOKIE_MAX_AGE,
  DEVICE_COOKIE_MAX_ENTRIES,
} from "@/lib/constants/auth";

const isHttps = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;

/** `__Host-wt-device` on https (NextAuth's own rule), otherwise `wt-device`. */
export const DEVICE_COOKIE_NAME: string = isHttps
  ? "__Host-wt-device"
  : "wt-device";

export const DEVICE_COOKIE_OPTIONS: {
  httpOnly: true;
  secure: boolean;
  sameSite: "strict";
  path: "/";
  maxAge: number;
} = {
  httpOnly: true,
  secure: isHttps,
  sameSite: "strict",
  path: "/",
  maxAge: DEVICE_COOKIE_MAX_AGE,
};

const MAX_VALUE_LENGTH = 2048;
const CLOCK_SKEW_SEC = 60;
const NONCE_RE = /^[A-Za-z0-9_-]{22}$/;
const SIG_RE = /^[A-Za-z0-9_-]{43}$/;
const IAT_RE = /^\d{1,12}$/;

interface Entry {
  nonce: string;
  iat: number;
  sig: string;
}

function signingKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  return Buffer.from(
    hkdfSync("sha256", secret, "", "wt-device-cookie-v1", 32),
  );
}

function sign(key: Buffer, email: string, nonce: string, iat: number): string {
  return createHmac("sha256", key)
    .update(`wt-device.v1|${email}|${nonce}|${iat}`)
    .digest("base64url");
}

/** Well-formed and inside the time window; says nothing about the signature. */
function parseEntries(value: string | undefined, nowSec: number): Entry[] {
  if (!value || value.length > MAX_VALUE_LENGTH) return [];
  const entries: Entry[] = [];
  for (const raw of value.split("~").slice(0, DEVICE_COOKIE_MAX_ENTRIES)) {
    const [nonce, iatStr, sig, ...extra] = raw.split(".");
    if (
      extra.length > 0 ||
      !NONCE_RE.test(nonce ?? "") ||
      !IAT_RE.test(iatStr ?? "") ||
      !SIG_RE.test(sig ?? "")
    ) {
      continue;
    }
    const iat = Number(iatStr);
    if (iat > nowSec + CLOCK_SKEW_SEC || nowSec - iat > DEVICE_COOKIE_MAX_AGE) {
      continue;
    }
    entries.push({ nonce, iat, sig });
  }
  return entries;
}

function isSignedFor(key: Buffer, email: string, e: Entry): boolean {
  const expected = Buffer.from(sign(key, email, e.nonce, e.iat));
  const actual = Buffer.from(e.sig);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const toValue = (entries: Entry[]) =>
  entries.map((e) => `${e.nonce}.${e.iat}.${e.sig}`).join("~");

/**
 * Returns the nonce of the first valid entry minted for `email`, or null
 * when the cookie is absent, malformed or holds no valid entry for it.
 */
export function findTrustedDevice(
  cookieValue: string | undefined,
  email: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): string | null {
  const entries = parseEntries(cookieValue, nowSec);
  if (entries.length === 0) return null;
  const key = signingKey();
  return entries.find((e) => isSignedFor(key, email, e))?.nonce ?? null;
}

/**
 * Returns the new cookie value after a successful sign-in: keeps the
 * existing nonce for `email` (refreshing it) or mints one, keeps other
 * users' valid entries, newest first, at most DEVICE_COOKIE_MAX_ENTRIES.
 */
export function issueDeviceCookie(
  cookieValue: string | undefined,
  email: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): string {
  const key = signingKey();
  const existing = parseEntries(cookieValue, nowSec);
  const mine = existing.find((e) => isSignedFor(key, email, e));
  const nonce = mine?.nonce ?? randomBytes(16).toString("base64url");
  const fresh: Entry = {
    nonce,
    iat: nowSec,
    sig: sign(key, email, nonce, nowSec),
  };
  const others = existing.filter((e) => e !== mine);
  return toValue([fresh, ...others].slice(0, DEVICE_COOKIE_MAX_ENTRIES));
}
