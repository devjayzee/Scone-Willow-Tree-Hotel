import type { NextRequest } from "next/server";

/**
 * Extracts the client IP address from a Next.js request.
 * Checks x-forwarded-for and x-real-ip headers (set by proxies/load balancers),
 * falling back to localhost if neither is present.
 *
 * @param req - The Next.js request object
 * @returns The client's IP address
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; the first is the client
    return forwarded.split(",")[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  return "127.0.0.1";
}
