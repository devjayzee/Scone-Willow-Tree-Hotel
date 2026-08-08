import { ResendTransport } from "@/lib/email/resend-transport";
import { DevLogTransport } from "@/lib/email/dev-transport";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

let transport: EmailTransport | null = null;

/**
 * Missing Resend config falls back to a log-only transport so the
 * forgot-password flow stays functional in local dev without a mail account.
 */
export function getEmailTransport(): EmailTransport {
  if (!transport) {
    transport =
      process.env.RESEND_API_KEY && process.env.EMAIL_FROM
        ? new ResendTransport(
            process.env.RESEND_API_KEY,
            process.env.EMAIL_FROM
          )
        : new DevLogTransport();
  }
  return transport;
}
