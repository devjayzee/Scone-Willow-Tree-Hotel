import type { Role } from "@prisma/client";

export interface ResolvedInviteResponse {
  email: string;
  firstName: string;
  role: Role;
}

/**
 * Wire shape of the login-form pre-check. `resetAt` is a Unix ms epoch;
 * `remaining` uses the sentinel `999` when the limiter is disabled
 * (Upstash env unset).
 */
export interface LoginRateLimitStatus {
  limited: boolean;
  remaining: number;
  resetAt: number;
}
