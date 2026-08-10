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

// Fail fast in production: the DevLogTransport writes the reset URL (with
// raw token) to logs, which would be a credential leak in prod. In dev it's
// the intended fallback so the forgot-password flow works without a mail
// account.
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
) {
  throw new Error(
    "RESEND_API_KEY and EMAIL_FROM must be set in production. " +
      "Falling back to the log-only transport would leak reset tokens to logs."
  );
}

let transport: EmailTransport | null = null;

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
