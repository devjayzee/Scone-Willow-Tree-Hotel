import type { NextConfig } from "next";

// Content-Security-Policy — restrictive baseline for a first-party dashboard
// with no third-party scripts. `'unsafe-inline'` on style-src is required by
// shadcn/Radix primitives and react-big-calendar (both inject inline styles).
// Script sources stay `'self'` only; no CDN or third-party analytics.
// Tighten further with hashes/nonces if the CSS story ever changes.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self' data:",
  "connect-src 'self' https://*.upstash.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
];

const nextConfig: NextConfig = {
  // Drop the "X-Powered-By: Next.js" header — no security benefit to leaking
  // the framework version.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
