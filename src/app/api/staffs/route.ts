import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStaffSchema } from "@/lib/validations/staff";
import { getAllStaff, createStaff } from "@/lib/services/staff";
import { getEmailTransport } from "@/lib/email/email-transport";
import { inviteSetupEmail } from "@/lib/email/templates/invite-setup";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from "@/lib/api-error-handler";
import { withRequestAuditContext } from "@/lib/utils/with-request-audit-context";
import { logger } from "@/lib/logger";
import { getStaffInviteRateLimiter } from "@/lib/services/rate-limit-service";
import { isAllowedRecipientDomain } from "@/lib/utils/email-domain-allowlist";

// GET /api/staffs - Get all staff members
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      throw new ForbiddenError("Only general managers can view staff list");
    }

    const staffs = await getAllStaff();
    return NextResponse.json(staffs);
  } catch (error) {
    return handleApiError(error, "fetching staffs");
  }
}

// POST /api/staffs - Create a new staff member
export async function POST(request: Request) {
  return withRequestAuditContext(request, async () => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        throw new UnauthorizedError();
      }

      if (session.user.role !== "GENERAL_MANAGER") {
        throw new ForbiddenError("Only general managers can create staff");
      }

      // Per-user cap on invite creation. Tightens the generic
      // 120/min API limit for this specific endpoint so a compromised or
      // published GM credential can't spray outbound invites through the
      // verified Resend domain. No-op when Upstash isn't configured.
      const limiter = getStaffInviteRateLimiter();
      if (limiter) {
        const { success } = await limiter.limit(session.user.id);
        if (!success) {
          throw new RateLimitError(
            "Too many staff invites. Try again later.",
          );
        }
      }

      const body = await request.json();
      const validation = createStaffSchema.safeParse(body);

      if (!validation.success) {
        return handleApiError(validation.error, "creating staff");
      }

      // Optional recipient-domain gate: unset env → no-op. When set
      // on the demo deployment, blocks invites to arbitrary domains.
      if (!isAllowedRecipientDomain(validation.data.email)) {
        throw new ValidationError(
          "Recipient email domain is not allowed on this deployment.",
        );
      }

      const { staff, setupToken } = await createStaff(
        validation.data,
        session.user.id
      );

      // Send the invite AFTER the response — response is snappy, mailer
      // failure logs but doesn't 500 (the resend endpoint covers
      // recovery). Same pattern as forgot-password. The raw
      // token stays server-side; only the email carries it.
      const { subject, text, html } = inviteSetupEmail({
        firstName: staff.firstName,
        rawToken: setupToken,
      });
      const to = staff.email;
      const staffId = staff.id;
      after(async () => {
        try {
          await getEmailTransport().send({ to, subject, text, html });
        } catch (mailError) {
          logger.error("Failed to send staff invite email", mailError, {
            staffId,
          });
        }
      });

      return NextResponse.json(staff, { status: 201 });
    } catch (error) {
      return handleApiError(error, "creating staff");
    }
  });
}
