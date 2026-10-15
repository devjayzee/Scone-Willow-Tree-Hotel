/**
 * bcrypt work factor for password hashing.
 *
 * OWASP 2024 baseline is 10-12. New hashes use 12; older cost-10 hashes
 * still authenticate (bcrypt.compare is cost-agnostic) and get rehashed
 * to cost 12 on their next successful login — see `src/lib/auth.ts`.
 */
export const BCRYPT_COST = 12;

/**
 * Pre-generated bcrypt hash at BCRYPT_COST of a discarded random string.
 * Used in `authorize()` to equalize wall-clock time between the
 * unknown-email / deactivated-account branches and the wrong-password
 * branch. Cost must match BCRYPT_COST so timing stays balanced
 * for freshly-created users.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$2dhWLqqSCuGQB//5al.dj.d.q4FkRAbHBk5h2ur.IQVyjoBKKJYrC";

/**
 * Session lifetime for a normal (unchecked) login — 12h accommodates
 * hotel double / overnight shifts while halving the leaked-token window
 * vs. the previous 24h default.
 */
export const SESSION_MAX_AGE_STANDARD = 12 * 60 * 60;

/**
 * Session lifetime when the user checks "Remember this device" — 30 days.
 * Also the cookie's on-disk lifetime (NextAuth v4 can't scope the cookie
 * per login), so unchecked-remember tokens expire at
 * SESSION_MAX_AGE_STANDARD but the cookie itself sticks around until
 * SESSION_MAX_AGE_REMEMBER. Enforcement is inside the jwt callback via
 * token.expiresAt.
 */
export const SESSION_MAX_AGE_REMEMBER = 30 * 24 * 60 * 60;

/**
 * How often the session re-signs itself (NextAuth `updateAge`), keeping
 * the token's expiry rolling forward on an active session.
 */
export const SESSION_UPDATE_AGE = 60 * 60;

/**
 * `useSession`'s client-side poll interval, in seconds (T).
 *
 * Budget note: one tab's poll or focus refetch is broadcast by next-auth to
 * the other tabs, which each refetch once. With n tabs in one browser a poll
 * round costs at most n^2 session fetches (8 Chrome tabs measured about 22,
 * thanks to same-second merging), and a whole round can land in one 60 s
 * window. Add n per tab switch and n per full page load, including the
 * dashboard's `hardReload` (ADR-019).
 *
 * `SESSION_ENDPOINT_LIMIT_PER_MINUTE` is sized for that window peak: 8 tabs'
 * round (64) plus 12 switches (96) = 160 <= 180, which a test in
 * `rate-limit-service.test.ts` pins. Changing T, `refetchOnWindowFocus` or
 * the limit means re-checking that test.
 *
 * 300 s also keeps Upstash commands down (each limiter call is about 2
 * commands), within the free tier.
 */
export const SESSION_POLL_INTERVAL_SECONDS = 300;

/**
 * Session-endpoint requests allowed per minute per live session identity.
 * Sized for the multi-tab fan-out described above, not for a single poll.
 */
export const SESSION_ENDPOINT_LIMIT_PER_MINUTE = 180;

/** How long a forgot-password reset link stays valid. */
export const RESET_TOKEN_TTL_MINUTES = 30;

/** How long a new-staff invite / setup link stays valid. */
export const SETUP_TOKEN_TTL_HOURS = 72;

/** The message `authorize()` throws for any failed credential check. */
export const INVALID_CREDENTIALS = "Invalid email or password";

/** `authorize()` error code for a login-limit refusal; URL-safe. */
export const SIGN_IN_PAUSED = "SignInPaused";

/** Trusted-device cookie lifetime in seconds (180 days). */
export const DEVICE_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;

/** Most device entries kept in one trusted-device cookie. */
export const DEVICE_COOKIE_MAX_ENTRIES = 10;

/**
 * TTL of the `trusted-device:valid-after:<email>` key: the cookie lifetime
 * plus a minute, so the key outlives every entry it can revoke.
 */
export const DEVICE_REVOCATION_TTL = DEVICE_COOKIE_MAX_AGE + 60;

/** Longest the sign-in path waits on the valid-after read before treating the entry as revoked. */
export const DEVICE_REVOCATION_READ_TIMEOUT_MS = 1000;
