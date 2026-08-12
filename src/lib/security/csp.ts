// Per-request Content-Security-Policy builder (#141). Called from
// middleware with a fresh nonce and the dev/prod flag; returns the
// header value.
//
// The prod branch drops `'unsafe-inline'` from script-src and pairs a
// `'nonce-<value>'` allowlist with `'strict-dynamic'` — scripts
// loaded by nonce'd scripts (Next.js' own hydration + chunks) also
// execute, everything else is blocked. Restores the inline-XSS
// protection the #130 CSP hotfix deferred.
//
// Dev keeps `'unsafe-inline' 'unsafe-eval'` because React Refresh /
// HMR would break otherwise — same behaviour the file had before
// this refactor, just plumbed through here.

// Hash-allowlist for Next's built-in inline bootstrapper script.
// Neither Turbopack nor webpack applies the nonce to this specific
// inline <script> tag (framework limitation, observed on both
// bundlers in PR #216). The browser reports the same SHA-256 across
// every request, meaning the script content is deterministic and
// safe to hash-allowlist without loosening the rest of the policy.
// If Next ships an update that changes the script, the Playwright
// smoke fires "Executing inline script violates..." with the new
// expected hash — update the constant and re-ship.
const NEXT_INLINE_SCRIPT_HASH =
  "'sha256-4K+w1hIPlZOtzk96eh4nfnS4/r44EA030s2K6ASQsek='";

export function buildCsp({
  nonce,
  dev,
}: {
  nonce: string;
  dev: boolean;
}): string {
  const scriptSrc = dev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${NEXT_INLINE_SCRIPT_HASH}`;

  return [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    "font-src 'self' data:",
    "connect-src 'self' https://*.upstash.io",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
