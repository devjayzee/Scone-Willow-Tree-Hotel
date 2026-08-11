import { SETUP_TOKEN_TTL_HOURS } from "@/lib/services/password-reset-service";
import { APP_BASE_URL } from "@/lib/email/app-url";
import { escapeHtml } from "@/lib/email/escape-html";

export function inviteSetupEmail(input: {
  firstName: string;
  rawToken: string;
}): { subject: string; text: string; html: string } {
  const url = `${APP_BASE_URL}/setup-password?token=${encodeURIComponent(input.rawToken)}`;
  const subject = "You're invited to the Willow Tree team";
  const text = [
    `Hi ${input.firstName},`,
    "",
    "You've been invited to the Willow Tree booking-management system.",
    "",
    `Create your password to finish setting up your account: ${url}`,
    "",
    `This invite expires in ${SETUP_TOKEN_TTL_HOURS} hours.`,
    "",
    "Scone Willow Tree Hotel",
  ].join("\n");
  const html = `
<p>Hi ${escapeHtml(input.firstName)},</p>
<p>You've been invited to the Willow Tree booking-management system.</p>
<p><a href="${url}">Create your password</a> to finish setting up your account.</p>
<p>This invite expires in ${SETUP_TOKEN_TTL_HOURS} hours.</p>
<p>Scone Willow Tree Hotel</p>
`.trim();
  return { subject, text, html };
}
