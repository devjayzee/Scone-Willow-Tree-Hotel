import { RESET_TOKEN_TTL_MINUTES } from "@/lib/services/password-reset-service";

export function passwordResetEmail(input: {
  firstName: string;
  rawToken: string;
}): { subject: string; text: string; html: string } {
  const url = `${process.env.NEXTAUTH_URL}/reset-password?token=${input.rawToken}`;
  const subject = "Reset your Willow Tree password";
  const text = [
    `Hi ${input.firstName},`,
    "",
    "We received a request to reset your Willow Tree booking-management password.",
    "",
    `Reset it here: ${url}`,
    "",
    `This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes. If you didn't request this, ignore this email.`,
    "",
    "Scone Willow Tree Hotel",
  ].join("\n");
  const html = `
<p>Hi ${input.firstName},</p>
<p>We received a request to reset your Willow Tree booking-management password.</p>
<p><a href="${url}">Set a new password</a></p>
<p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes. If you didn't request this, ignore this email.</p>
<p>Scone Willow Tree Hotel</p>
`.trim();
  return { subject, text, html };
}
