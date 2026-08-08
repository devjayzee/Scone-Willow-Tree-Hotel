import { NextResponse } from "next/server";
import { resolveSetupInvite } from "@/lib/services/password-reset-service";
import { handleApiError } from "@/lib/api-error-handler";
import { NotFoundError } from "@/lib/errors";

// GET /api/auth/invite/[token] - Public (Rule 4 /api/auth/** exception).
// Resolves a SETUP token to the invitee's { email, firstName, role } for the
// setup-password page. 404 for any invalid/expired/used token.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      throw new NotFoundError("This link is invalid or has expired");
    }

    const invite = await resolveSetupInvite(token);
    return NextResponse.json(invite);
  } catch (error) {
    return handleApiError(error, "resolving invite");
  }
}
