import { RESET_TOKEN_TTL_MINUTES } from "@/lib/constants/auth";
import { APP_BASE_URL } from "@/lib/email/app-url";
import { escapeHtml } from "@/lib/email/escape-html";

const POSTAL_ADDRESS = "136 Kelly St, Scone NSW 2337, Australia";

export function passwordResetEmail(input: {
  firstName: string;
  rawToken: string;
}): { subject: string; text: string; html: string } {
  const url = `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(input.rawToken)}`;
  const subject = "Reset your Willow Tree password";

  const text = [
    `Hi ${input.firstName},`,
    "",
    "We received a request to reset the password for your Willow Tree booking-management account.",
    "",
    `Set a new password: ${url}`,
    "",
    `This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes. If it runs out, request a new one from the sign-in page.`,
    "",
    "Didn't request this? You can safely ignore this email - your password stays unchanged.",
    "",
    "Scone Willow Tree Hotel",
    POSTAL_ADDRESS,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Reset your Willow Tree password</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  @media only screen and (max-width: 620px) {
    .wrap { width: 100% !important; }
    .pad { padding-left: 24px !important; padding-right: 24px !important; }
    .h1 { font-size: 28px !important; line-height: 34px !important; }
    .btn a { display: block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f0e8d8;">
<span style="display:none;font-size:1px;color:#f0e8d8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Set a new password for your Willow Tree booking account. This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</span>
<span style="display:none;font-size:1px;color:#f0e8d8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">&#8203;&#847;&zwnj;&nbsp;&#8199;&#65279;&#8203;&#847;&zwnj;&nbsp;&#8199;&#65279;&#8203;&#847;&zwnj;&nbsp;&#8199;&#65279;&#8203;&#847;&zwnj;&nbsp;&#8199;&#65279;</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f0e8d8;">
<tr>
<td align="center" style="padding:32px 12px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="wrap" style="width:600px;max-width:600px;">

<!-- Brand band -->
<tr>
<td bgcolor="#1e3a5f" align="center" class="pad" style="background-color:#1e3a5f;padding:36px 40px 32px 40px;border-radius:12px 12px 0 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
    <tr>
      <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;mso-line-height-rule:exactly;letter-spacing:3px;color:#c9a227;font-weight:bold;padding-bottom:14px;">SCONE &middot; NSW</td>
    </tr>
    <tr>
      <td align="center" style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:36px;mso-line-height-rule:exactly;color:#f5e6c8;letter-spacing:1px;">Scone Willow Tree Hotel</td>
    </tr>
    <tr>
      <td align="center" style="padding-top:18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="44" style="width:44px;">
          <tr><td height="2" bgcolor="#c9a227" style="height:2px;line-height:2px;font-size:2px;background-color:#c9a227;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- Card -->
<tr>
<td bgcolor="#fffdf8" class="pad" style="background-color:#fffdf8;padding:40px 40px 8px 40px;border-left:1px solid #ddd2b6;border-right:1px solid #ddd2b6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;mso-line-height-rule:exactly;letter-spacing:2.5px;font-weight:bold;color:#a6851f;padding-bottom:12px;">ACCOUNT RECOVERY</td>
    </tr>
    <tr>
      <td class="h1" style="font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:38px;mso-line-height-rule:exactly;color:#1e3a5f;padding-bottom:20px;">Reset your password</td>
    </tr>
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;mso-line-height-rule:exactly;color:#1e3a5f;padding-bottom:14px;">Hi ${escapeHtml(input.firstName)},</td>
    </tr>
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;mso-line-height-rule:exactly;color:#4a5a6b;padding-bottom:28px;">We received a request to reset the password for your Willow Tree booking-management account. Choose a new one using the button below.</td>
    </tr>
  </table>
</td>
</tr>

<!-- Button -->
<tr>
<td bgcolor="#fffdf8" class="pad" style="background-color:#fffdf8;padding:0 40px 28px 40px;border-left:1px solid #ddd2b6;border-right:1px solid #ddd2b6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
    <tr>
      <td class="btn" bgcolor="#1e3a5f" align="center" style="background-color:#1e3a5f;border-radius:10px;">
        <a href="${url}" style="display:inline-block;padding:16px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;mso-line-height-rule:exactly;font-weight:bold;color:#f5e6c8;text-decoration:none;border-radius:10px;">Set a new password</a>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- Expiry notice -->
<tr>
<td bgcolor="#fffdf8" class="pad" style="background-color:#fffdf8;padding:0 40px 28px 40px;border-left:1px solid #ddd2b6;border-right:1px solid #ddd2b6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background-color:#faf4e8;border:1px solid #ddd2b6;border-radius:10px;">
    <tr>
      <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:#4a5a6b;">
        <span style="color:#1e3a5f;font-weight:bold;">This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</span> If it runs out, request a new one from the sign-in page.
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- Fallback URL -->
<tr>
<td bgcolor="#fffdf8" class="pad" style="background-color:#fffdf8;padding:0 40px 32px 40px;border-left:1px solid #ddd2b6;border-right:1px solid #ddd2b6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:#77808c;padding-bottom:6px;">Button not working? Paste this into your browser:</td>
    </tr>
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;mso-line-height-rule:exactly;word-break:break-all;"><a href="${url}" style="color:#a6851f;text-decoration:underline;">${url}</a></td>
    </tr>
  </table>
</td>
</tr>

<!-- Security line -->
<tr>
<td bgcolor="#fffdf8" class="pad" style="background-color:#fffdf8;padding:0 40px 36px 40px;border-left:1px solid #ddd2b6;border-right:1px solid #ddd2b6;border-bottom:1px solid #ddd2b6;border-radius:0 0 12px 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
    <tr><td height="1" bgcolor="#ede4cd" style="height:1px;line-height:1px;font-size:1px;background-color:#ede4cd;">&nbsp;</td></tr>
    <tr>
      <td style="padding-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:#4a5a6b;">
        <span style="color:#b8543f;font-weight:bold;">Didn't request this?</span> You can safely ignore this email &mdash; your password stays unchanged. If you get these repeatedly, tell the duty manager.
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- Footer -->
<tr>
<td class="pad" style="padding:28px 40px 8px 40px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
    <tr>
      <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:#1e3a5f;font-weight:bold;padding-bottom:6px;">Scone Willow Tree Hotel</td>
    </tr>
    <tr>
      <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;mso-line-height-rule:exactly;color:#8a8471;">Hotel &middot; Restaurant &middot; Bar &middot; Gelato<br>${POSTAL_ADDRESS}</td>
    </tr>
    <tr>
      <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;mso-line-height-rule:exactly;color:#9a937f;padding-top:14px;">This is an automated security message about your staff account. It is not marketing and cannot be unsubscribed from.</td>
    </tr>
  </table>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
