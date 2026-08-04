import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/utils/get-client-ip";
import { getLoginRateLimitStatus } from "@/lib/services/rate-limit-service";
import { handleApiError } from "@/lib/api-error-handler";

// GET /api/auth/rate-limit-status - Pre-check for the login page.
// Public endpoint (Rule 4 allowed exception for /api/auth/**); read-only —
// does not consume a rate-limit token.
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const status = await getLoginRateLimitStatus(ip);
    return NextResponse.json(status);
  } catch (error) {
    return handleApiError(error, "checking rate limit");
  }
}
