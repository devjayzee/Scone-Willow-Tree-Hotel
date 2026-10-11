import type { Role } from "@prisma/client";

export interface ResolvedInviteResponse {
  email: string;
  firstName: string;
  role: Role;
}

/**
 * Wire shape of the login-form pre-check. `resetAt` is a Unix ms epoch;
 * `remaining` uses the sentinel `999` when the limiter is disabled
 * (Upstash env unset) or the limit is not applicable to this client (a
 * trusted device skips the IP bucket).
 */
export interface LoginRateLimitStatus {
  limited: boolean;
  remaining: number;
  resetAt: number;
}
