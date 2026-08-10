import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resendInvite } from "@/lib/services/staff";
import { getEmailTransport } from "@/lib/email/transport";
import { inviteSetupEmail } from "@/lib/email/templates/invite-setup";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/api-error-handler";
import { withRequestAuditContext } from "@/lib/utils/with-request-audit-context";
import { logger } from "@/lib/logger";

// POST /api/staffs/[id]/resend-invite — reissue a setup invite for an
// inactive staff member (#144). The previous token is voided by
// issueSetupTokenForUser as a side effect, so the old email link 404s
// immediately.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestAuditContext(request, async () => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        throw new UnauthorizedError();
      }
      if (session.user.role !== "GENERAL_MANAGER") {
        throw new ForbiddenError("Only managers can resend staff invites");
      }

      const { id } = await params;
      const { user, setupToken } = await resendInvite(id, session.user.id);

      const { subject, text, html } = inviteSetupEmail({
        firstName: user.firstName,
        rawToken: setupToken,
      });
      const to = user.email;
      const staffId = user.id;
      after(async () => {
        try {
          await getEmailTransport().send({ to, subject, text, html });
        } catch (mailError) {
          logger.error("Failed to resend staff invite email", mailError, {
            staffId,
          });
        }
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError(error, "resending staff invite");
    }
  });
}
