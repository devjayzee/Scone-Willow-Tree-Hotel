// Shared HTML-escape helper for outbound email templates (#184).
// Extracted from password-reset.ts (#178) so invite-setup.ts uses the
// same implementation. Escapes the five characters that can break out
// of an HTML text/attribute context: & < > " '.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
