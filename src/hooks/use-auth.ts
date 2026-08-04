"use client";

import type { LoginRateLimitStatus } from "@/lib/services/rate-limit-service";

/**
 * Read-only pre-check consumed by the login form to short-circuit a
 * doomed `signIn` call. Middleware still enforces the actual limit —
 * this is UX sugar.
 */
export async function fetchLoginRateLimitStatus(): Promise<LoginRateLimitStatus> {
  const response = await fetch("/api/auth/rate-limit-status");
  if (!response.ok) {
    throw new Error("Failed to check rate limit");
  }
  return response.json();
}
