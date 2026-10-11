import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import {
  DEVICE_COOKIE_NAME,
  DEVICE_COOKIE_OPTIONS,
  issueDeviceCookie,
} from "@/lib/utils/device-cookie";
import { normalizeEmail } from "@/lib/validations/email";

/**
 * Marks the browser that just completed a reset or setup as trusted for
 * `email`. The entry's iat is `validAfter + 1`: it must be strictly newer
 * than the revocation it follows, and `parseEntries` accepts up to now + 60.
 * Never throws; a cookie failure must not fail the reset.
 */
export async function trustCompletingBrowser(
  email: string,
  validAfter: number | null,
): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(
      DEVICE_COOKIE_NAME,
      issueDeviceCookie(
        jar.get(DEVICE_COOKIE_NAME)?.value,
        normalizeEmail(email),
        validAfter === null ? undefined : validAfter + 1,
      ),
      DEVICE_COOKIE_OPTIONS,
    );
  } catch (error) {
    logger.warn("could not set trusted-device cookie", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
