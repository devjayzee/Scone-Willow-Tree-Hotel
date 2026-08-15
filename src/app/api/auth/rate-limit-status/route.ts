import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/utils/get-client-ip";
import {
  getLoginRateLimitStatus,
  getRateLimitStatusLimiter,
} from "@/lib/services/rate-limit-service";
import { handleApiError } from "@/lib/api-error-handler";

// GET /api/auth/rate-limit-status - Pre-check for the login page.
// Public endpoint (Rule 4 allowed exception for /api/auth/**); read-only —
// does not consume a login-limit token. A generous 60/min IP cap
// prevents a flood from burning Upstash quota; on denial we
// return the same "limited" shape rather than a 429 so the login-page
// pre-check UX stays intact for legitimate users caught in the tail.
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const gate = getRateLimitStatusLimiter();
    if (gate) {
      const { success } = await gate.limit(ip);
      if (!success) {
        return NextResponse.json({
          limited: true,
          remaining: 0,
          resetAt: 0,
        });
      }
    }

    const status = await getLoginRateLimitStatus(ip);
    return NextResponse.json(status);
  } catch (error) {
    return handleApiError(error, "checking rate limit");
  }
}
