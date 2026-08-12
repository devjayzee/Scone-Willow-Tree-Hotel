import type { NextConfig } from "next";

// Content-Security-Policy is set per-request in `src/middleware.ts`
// via `buildCsp` from `@/lib/security/csp` — the header needs a
// fresh nonce on every request so `strict-dynamic` can restore
// inline-XSS protection (#141). All other security headers stay
// here because they're identical on every response.
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
