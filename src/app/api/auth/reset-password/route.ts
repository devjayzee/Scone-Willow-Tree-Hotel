import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validations/auth-token";
import { consumeResetToken } from "@/lib/services/password-reset-service";
import { trustCompletingBrowser } from "@/lib/utils/trust-browser";
import { handleApiError } from "@/lib/api-error-handler";
import { AppError } from "@/lib/errors";
import { isJsonRequest } from "@/lib/utils/is-json-request";
import { withRequestAuditContext } from "@/lib/utils/with-request-audit-context";
import { readJsonBody } from "@/lib/utils/read-json-body";

// POST /api/auth/reset-password - Public (Rule 4 /api/auth/** exception).
// Identity is proven by possession of a valid RESET token, not a session.
export async function POST(request: Request) {
  return withRequestAuditContext(request, async () => {
    try {
      if (!isJsonRequest(request)) {
        throw new AppError("Send the request as JSON.", 415);
      }
      const body = await readJsonBody(request);
      const validation = resetPasswordSchema.safeParse(body);
      if (!validation.success) {
        return handleApiError(validation.error, "resetting password");
      }

      const { email, validAfter } = await consumeResetToken({
        rawToken: validation.data.token,
        newPassword: validation.data.password,
      });
      // claude-allow: rule-1 — sets the trusted-device cookie; cookies() is HTTP-layer, so it can't live in the service
      await trustCompletingBrowser(email, validAfter);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError(error, "resetting password");
    }
  });
}
