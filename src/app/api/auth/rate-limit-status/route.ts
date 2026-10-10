import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/utils/get-client-ip";
import { getLoginPrecheckStatus } from "@/lib/services/rate-limit-service";
import { handleApiError } from "@/lib/api-error-handler";

// GET /api/auth/rate-limit-status - Pre-check for the login page.
// Public endpoint (Rule 4 allowed exception for /api/auth/**). If the
// endpoint's own IP gate trips it answers an honest 429, which the login
// form treats as "unknown, go ahead and sign in" (ADR-008).
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const status = await getLoginPrecheckStatus(ip);
    return NextResponse.json(status);
  } catch (error) {
    return handleApiError(error, "checking rate limit");
  }
}
