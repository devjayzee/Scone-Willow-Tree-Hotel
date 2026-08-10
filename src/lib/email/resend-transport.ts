import type { EmailMessage, EmailTransport } from "@/lib/email/email-transport";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export class ResendTransport implements EmailTransport {
  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      // Never include the message body here — it carries the raw token.
      throw new Error(
        `Resend request failed (${response.status}): ${body.slice(0, 500)}`
      );
    }
  }
}
