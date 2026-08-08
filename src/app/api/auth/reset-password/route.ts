import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validations/auth-token";
import { consumeResetToken } from "@/lib/services/password-reset-service";
import { handleApiError } from "@/lib/api-error-handler";
import { withRequestAuditContext } from "@/lib/utils/with-request-audit-context";

// POST /api/auth/reset-password - Public (Rule 4 /api/auth/** exception).
// Identity is proven by possession of a valid RESET token, not a session.
export async function POST(request: Request) {
  return withRequestAuditContext(request, async () => {
    try {
      const body = await request.json();
      const validation = resetPasswordSchema.safeParse(body);
      if (!validation.success) {
        return handleApiError(validation.error, "resetting password");
      }

      await consumeResetToken({
        rawToken: validation.data.token,
        newPassword: validation.data.password,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError(error, "resetting password");
    }
  });
}
