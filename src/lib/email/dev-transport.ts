import { logger } from "@/lib/logger";
import type { EmailMessage, EmailTransport } from "@/lib/email/transport";

/**
 * Log-only transport for local dev (no RESEND_API_KEY / EMAIL_FROM set).
 * Logs the plain-text body so the reset/invite link is copyable from the
 * server console.
 */
export class DevLogTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<void> {
    logger.info("Email (dev transport — not sent)", {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
