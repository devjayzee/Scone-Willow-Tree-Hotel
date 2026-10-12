// Per-request Content-Security-Policy. Shared by src/proxy.ts and server
// components, so it uses Web Crypto only, no Node APIs.

// Request header the proxy sets so server components can read the nonce.
export const NONCE_HEADER = "x-nonce";

// 16 random bytes as standard base64 (24 characters, including "==").
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

// style-src never carries the nonce: browsers ignore 'unsafe-inline' when a
// nonce is present, which would break Radix, shadcn and react-big-calendar.
export function buildCsp({
  nonce,
  dev,
}: {
  nonce: string;
  dev: boolean;
}): string {
  return [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
