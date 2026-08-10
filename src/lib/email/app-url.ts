// Loud fail if the app base URL is missing (#143). NEXTAUTH_URL is
// already required by NextAuth itself (OAuth callbacks, post-login
// redirects) — this makes the failure surface at module load instead of
// as an unusable "undefined/reset-password?..." link in a delivered email.
const raw = process.env.NEXTAUTH_URL;
if (!raw) {
  throw new Error(
    "NEXTAUTH_URL is required — email templates render password-reset and invite-setup links from it.",
  );
}

// Strip trailing slash(es) so `${APP_BASE_URL}/reset-password` never
// produces a double slash if the env var is written with a trailing "/".
export const APP_BASE_URL = raw.replace(/\/+$/, "");
