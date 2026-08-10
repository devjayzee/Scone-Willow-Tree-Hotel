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
 * branch (#66). Cost must match BCRYPT_COST so timing stays balanced
 * for freshly-created users.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$2dhWLqqSCuGQB//5al.dj.d.q4FkRAbHBk5h2ur.IQVyjoBKKJYrC";

/**
 * Session lifetime for a normal (unchecked) login — 12h accommodates
 * hotel double / overnight shifts while halving the leaked-token window
 * vs. the pre-#67 24h default.
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
