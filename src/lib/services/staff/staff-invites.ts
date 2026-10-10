import prisma from "@/lib/prisma";
import type { CreateStaffSchemaInput } from "@/lib/validations/staff";
import { NotFoundError, BusinessRuleError } from "@/lib/errors";
import { AuditAction, EntityType, createAuditLog } from "../audit-service";
import {
  issueSetupTokenForUser,
  type DeferSend,
} from "../password-reset-service";
import { getEmailTransport } from "@/lib/email/email-transport";
import { inviteSetupEmail } from "@/lib/email/templates/invite-setup";
import { logger } from "@/lib/logger";
import { createStaff } from "./staff-mutations";
import {
  assertAllowedRecipient,
  spendInviteLimit,
} from "./staff-invite-limits";

const INVITE_LIMIT_MESSAGE = "Too many staff invites. Try again later.";

// The only place the invite email is built and sent. It runs after the
// response; a mail failure is logged, not thrown (resend covers recovery).
// The raw token stays server-side; only the email carries it.
function scheduleInviteEmail(
  deferSend: DeferSend,
  staff: { id: string; email: string; firstName: string },
  rawToken: string,
  failureMessage: string
): void {
  const { subject, text, html } = inviteSetupEmail({
    firstName: staff.firstName,
    rawToken,
  });
  const { id: staffId, email: to } = staff;
  deferSend(async () => {
    try {
      await getEmailTransport().send({ to, subject, text, html });
    } catch (mailError) {
      logger.error(failureMessage, mailError, {
        staffId,
      });
    }
  });
}

/**
 * Create a staff member and schedule their setup invite.
 * Zod (in the route) and the recipient allowlist refuse before the limiter,
 * so those refusals do not spend the invite budget (per-GM and
 * deployment-wide). The limiter runs before createStaff, so a duplicate
 * email (ConflictError) or a database failure spends one unit of each
 * bucket.
 *
 * @throws ValidationError if the recipient domain is not allowed
 * @throws RateLimitError past the per-GM or deployment-wide invite limit
 * @throws ConflictError if email already exists
 */
export async function inviteStaff(
  data: CreateStaffSchemaInput,
  performedBy: string,
  deferSend: DeferSend
) {
  assertAllowedRecipient(data.email);
  await spendInviteLimit(performedBy, INVITE_LIMIT_MESSAGE);

  const { staff, setupToken } = await createStaff(data, performedBy);
  scheduleInviteEmail(
    deferSend,
    staff,
    setupToken,
    "Failed to send staff invite email"
  );
  return staff;
}

/**
 * Reissue a setup invite for a pending invite only.
 * issueSetupTokenForUser voids any prior unused SETUP token for this
 * user by design, so the old link 404s the moment this succeeds.
 *
 * @throws NotFoundError if user missing
 * @throws BusinessRuleError if there is no pending invite (deactivated or setup already completed)
 * @throws ValidationError if the account's email domain is not allowed
 * @throws RateLimitError past the per-GM or deployment-wide invite limit
 */
export async function resendInvite(
  userId: string,
  performedBy: string,
  deferSend: DeferSend
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      isActive: true,
      setupPending: true,
    },
  });

  if (!user) {
    throw new NotFoundError("Staff not found");
  }

  if (!user.setupPending) {
    throw new BusinessRuleError(
      user.isActive
        ? "Cannot resend invite: this staff member has already completed setup"
        : "This account has been deactivated. Use Activate to restore access."
    );
  }

  assertAllowedRecipient(user.email);
  await spendInviteLimit(performedBy, INVITE_LIMIT_MESSAGE);

  const setupToken = await issueSetupTokenForUser(user.id);

  await createAuditLog(
    performedBy,
    AuditAction.STAFF_INVITE_RESENT,
    EntityType.STAFF,
    user.id,
    { reason: "Setup invite reissued via manager action" }
  );

  scheduleInviteEmail(
    deferSend,
    user,
    setupToken,
    "Failed to resend staff invite email"
  );
}
