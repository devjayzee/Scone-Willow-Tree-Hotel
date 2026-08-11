import type { NextConfig } from "next";

// Content-Security-Policy — restrictive baseline for a first-party dashboard
// with no third-party scripts. `'unsafe-inline'` on style-src is required by
// shadcn/Radix primitives and react-big-calendar (both inject inline styles).
// `'unsafe-inline'` on script-src is required by the Next.js App Router: it
// bootstraps hydration via inline scripts, so `script-src 'self'` alone
// breaks every interactive page (native form submits, dead buttons — took
// prod login down on 2026-08-08). The real tightening is a per-request
// nonce + 'strict-dynamic' generated in middleware — tracked as a follow-up.
// Dev additionally needs 'unsafe-eval' for React Refresh.
const SCRIPT_SRC =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  SCRIPT_SRC,
  "font-src 'self' data:",
  "connect-src 'self' https://*.upstash.io",
  // Block <object>, <embed>, <applet> plugin surfaces outright — we
  // don't render any, and it's the standard tightening pair for
  // script-src 'unsafe-inline' (#188).
  "object-src 'none'",
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
