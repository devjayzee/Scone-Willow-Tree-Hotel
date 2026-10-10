import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resendInvite } from "@/lib/services/staff";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/api-error-handler";
import { withRequestAuditContext } from "@/lib/utils/with-request-audit-context";

// POST /api/staffs/[id]/resend-invite — reissue a setup invite for a
// pending staff member. The service applies the recipient-domain
// allowlist and the per-GM invite limit, voids the previous token (so the
// old email link 404s immediately) and sends the email after the response.
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
        throw new ForbiddenError("Only general managers can resend staff invites");
      }

      const { id } = await params;
      await resendInvite(id, session.user.id, after);

      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError(error, "resending staff invite");
    }
  });
}
