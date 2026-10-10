import { ValidationError, RateLimitError } from "@/lib/errors";
import {
  getStaffInviteRateLimiter,
  getStaffInviteGlobalRateLimiter,
} from "../rate-limit-service";
import { isAllowedRecipientDomain } from "@/lib/utils/email-domain-allowlist";

// Optional recipient-domain gate: unset env is a no-op. When set on the
// demo deployment, blocks invites to arbitrary domains.
export function assertAllowedRecipient(email: string): void {
  if (!isAllowedRecipientDomain(email)) {
    throw new ValidationError(
      "Recipient email domain is not allowed on this deployment."
    );
  }
}

// Spends one unit of the outbound-mail budget: the per-GM bucket first, then
// the deployment-wide bucket. Per-GM goes first so a GM at their own cap can't
// burn the shared budget. Because the per-GM bucket is spent first, a refusal
// by the global bucket still costs the GM one per-GM unit; that is the accepted
// trade-off (ADR-007). Shared by invite create/resend and email changes
// (a changed address can receive password-reset mail). A limiter that isn't
// configured (no Upstash) is skipped.
export async function spendInviteLimit(
  performedBy: string,
  refusalMessage: string
): Promise<void> {
  const perGm = getStaffInviteRateLimiter();
  if (perGm) {
    const { success } = await perGm.limit(performedBy);
    if (!success) throw new RateLimitError(refusalMessage);
  }
  const global = getStaffInviteGlobalRateLimiter();
  if (global) {
    const { success } = await global.limit("global");
    if (!success) throw new RateLimitError(refusalMessage);
  }
}
