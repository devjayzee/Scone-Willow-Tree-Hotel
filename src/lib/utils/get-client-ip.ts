/**
 * Extracts the client IP address from a Next.js request in a way that is
 * safe against `x-forwarded-for` spoofing. Accepts the base `Request` type
 * (NextRequest extends Request; we only read headers here) so plain route-
 * handler `request` arguments work directly.
 *
 * Deployment assumptions:
 * - **Vercel (production):** the platform injects `x-real-ip` from the
 *   TCP connection. That header is not client-controllable, so we prefer it.
 *   Vercel does NOT strip a client-supplied `x-forwarded-for`; it appends,
 *   so the leftmost entry is attacker-controlled. Never trust the leftmost.
 * - **Self-hosted / other proxies:** `x-real-ip` on any request is
 *   attacker-controlled (nothing is stripping it). Ignore it entirely
 *   and use the **rightmost** entry of `x-forwarded-for` — that's the
 *   closest hop and is written by the immediate upstream proxy, not the
 *   client. If your chain has more than one trusted proxy, tighten this
 *   further (drop N rightmost entries).
 * - **Local dev:** neither header is present, so fall back to `127.0.0.1`.
 *
 * The Vercel/off-Vercel switch is driven by the platform-injected `VERCEL`
 * env var (`"1"` on Vercel, unset otherwise). Do NOT use
 * `NEXT_PUBLIC_VERCEL_ENV` — that's exposed to the client bundle.
 */
export function getClientIp(req: Request): string {
  if (process.env.VERCEL === "1") {
    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (entries.length > 0) {
      return entries[entries.length - 1];
    }
  }

  return "127.0.0.1";
}
