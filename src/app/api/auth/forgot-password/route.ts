import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations/auth-token";
import { issueResetTokenForEmail } from "@/lib/services/password-reset-service";
import { getForgotPasswordRateLimiter } from "@/lib/services/rate-limit-service";
import { getEmailTransport } from "@/lib/email/transport";
import { passwordResetEmail } from "@/lib/email/templates/password-reset";
import { handleApiError } from "@/lib/api-error-handler";
import { getClientIp } from "@/lib/utils/get-client-ip";
import { logger } from "@/lib/logger";

// POST /api/auth/forgot-password - Public (Rule 4 /api/auth/** exception).
// Always responds 200 { ok: true } whether or not the email matches a user —
// success means "request accepted", never "email sent".
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "requesting password reset");
    }
    const { email } = validation.data;

    const limiter = getForgotPasswordRateLimiter();
    if (limiter) {
      const [byIp, byEmail] = await Promise.all([
        limiter.limit(`ip:${getClientIp(request)}`),
        limiter.limit(`email:${email}`),
      ]);
      if (!byIp.success || !byEmail.success) {
        return NextResponse.json(
          { error: "Too many reset requests. Try again later." },
          { status: 429 }
        );
      }
    }

    const { emailedToken, user } = await issueResetTokenForEmail(email);
    if (emailedToken && user) {
      try {
        const { subject, text, html } = passwordResetEmail({
          firstName: user.firstName,
          rawToken: emailedToken,
        });
        await getEmailTransport().send({ to: user.email, subject, text, html });
      } catch (mailError) {
        // Still 200 — surfacing a mailer failure would leak account existence.
        logger.error("Failed to send password-reset email", mailError, {
          userId: user.id,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "requesting password reset");
  }
}
