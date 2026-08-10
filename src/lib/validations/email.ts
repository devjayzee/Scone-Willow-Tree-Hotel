import { z } from "zod";

/**
 * Case-insensitive account identifier: trim whitespace, lowercase, validate.
 * The email column is the join key across login, forgot-password, staff
 * creation, and rate-limit buckets — every one of them MUST agree on
 * normalization or lookups miss silently. Route new normalization through
 * this schema (or normalizeEmail below) instead of inline .toLowerCase()
 * calls.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

/**
 * Imperative counterpart to emailSchema for code paths that already have a
 * string (login authorize, rate-limit key derivation) and don't need zod's
 * full parse. Keeping both in sync is the whole point of the shared module.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
