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
