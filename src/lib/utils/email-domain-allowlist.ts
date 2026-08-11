// Optional recipient-domain gate for outbound invite emails (#182).
//
// When INVITE_DOMAIN_ALLOWLIST is set to a comma-separated list of
// hostnames, isAllowedRecipientDomain returns true only for emails whose
// domain (case-insensitively) matches one of the entries. Unset or empty
// → allow everything (existing deployments unaffected). Intended for the
// demo Vercel deploy: pair with the staff-invite rate limit so a
// compromised GM demo account can't spray invites from the verified
// Resend domain to arbitrary recipients.

function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isAllowedRecipientDomain(email: string): boolean {
  const allowlist = parseAllowlist(process.env.INVITE_DOMAIN_ALLOWLIST);
  if (allowlist.length === 0) return true;

  const domain = extractDomain(email);
  if (!domain) return false;

  return allowlist.includes(domain);
}
