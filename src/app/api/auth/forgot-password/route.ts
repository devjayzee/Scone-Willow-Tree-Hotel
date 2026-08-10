import { NextResponse, after } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations/auth-token";
import { requestPasswordReset } from "@/lib/services/password-reset-service";
import { handleApiError } from "@/lib/api-error-handler";
import { getClientIp } from "@/lib/utils/get-client-ip";

// POST /api/auth/forgot-password - Public (Rule 4 /api/auth/** exception).
// Always responds 200 { ok: true } whether or not the email matches a user —
// success means "request accepted", never "email sent". Rate-limit failures
// surface via handleApiError as 429.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "requesting password reset");
    }

    await requestPasswordReset(
      { email: validation.data.email, ip: getClientIp(request) },
      after,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "requesting password reset");
  }
}
