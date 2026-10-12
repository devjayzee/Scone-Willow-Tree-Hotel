import type { NextConfig } from "next";

// The per-request CSP (with a nonce) in src/lib/utils/csp.ts and src/proxy.ts
// covers HTML pages. The strict static CSP below covers /api only (JSON plus
// NextAuth's built-in HTML pages); the proxy sets no CSP on /api/*. Never add
// a static CSP to page routes: browsers enforce every CSP header they receive,
// and a static one would lack the nonce and block scripts.
const API_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

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
      {
        source: "/api/:path+",
        headers: [{ key: "Content-Security-Policy", value: API_CSP }],
      },
    ];
  },
};

export default nextConfig;
