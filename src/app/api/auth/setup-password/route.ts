import { NextResponse } from "next/server";
import { setupPasswordSchema } from "@/lib/validations/auth-token";
import { consumeSetupToken } from "@/lib/services/password-reset-service";
import { trustCompletingBrowser } from "@/lib/utils/trust-browser";
import { handleApiError } from "@/lib/api-error-handler";
import { AppError } from "@/lib/errors";
import { isJsonRequest } from "@/lib/utils/is-json-request";
import { withRequestAuditContext } from "@/lib/utils/with-request-audit-context";

// POST /api/auth/setup-password - Public (Rule 4 /api/auth/** exception).
// Identity is proven by possession of a valid SETUP token; also activates
// the account.
export async function POST(request: Request) {
  return withRequestAuditContext(request, async () => {
    try {
      if (!isJsonRequest(request)) {
        throw new AppError("Send the request as JSON.", 415);
      }
      const body = await request.json();
      const validation = setupPasswordSchema.safeParse(body);
      if (!validation.success) {
        return handleApiError(validation.error, "setting up password");
      }

      const { email, validAfter } = await consumeSetupToken({
        rawToken: validation.data.token,
        newPassword: validation.data.password,
      });
      // claude-allow: rule-1 — sets the trusted-device cookie; cookies() is HTTP-layer, so it can't live in the service
      await trustCompletingBrowser(email, validAfter);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError(error, "setting up password");
    }
  });
}
