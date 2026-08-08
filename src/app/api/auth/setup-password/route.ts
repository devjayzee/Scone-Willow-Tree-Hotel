import { NextResponse } from "next/server";
import { setupPasswordSchema } from "@/lib/validations/auth-token";
import { consumeSetupToken } from "@/lib/services/password-reset-service";
import { handleApiError } from "@/lib/api-error-handler";
import { withRequestAuditContext } from "@/lib/utils/with-request-audit-context";

// POST /api/auth/setup-password - Public (Rule 4 /api/auth/** exception).
// Identity is proven by possession of a valid SETUP token; also activates
// the account.
export async function POST(request: Request) {
  return withRequestAuditContext(request, async () => {
    try {
      const body = await request.json();
      const validation = setupPasswordSchema.safeParse(body);
      if (!validation.success) {
        return handleApiError(validation.error, "setting up password");
      }

      await consumeSetupToken({
        rawToken: validation.data.token,
        newPassword: validation.data.password,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError(error, "setting up password");
    }
  });
}
