import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResendTransport } from "@/lib/email/resend-transport";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const API_KEY = "test-key";
const FROM = "noreply@willowtree.example";

describe("ResendTransport", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("POSTs to the Resend endpoint with Authorization and JSON body", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const transport = new ResendTransport(API_KEY, FROM);
    await transport.send({
      to: "user@example.com",
      subject: "Reset your password",
      text: "plain body",
      html: "<p>html body</p>",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RESEND_ENDPOINT);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("serializes from/to/subject/text/html into the request body", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const transport = new ResendTransport(API_KEY, FROM);
    await transport.send({
      to: "user@example.com",
      subject: "Reset your password",
      text: "plain body",
      html: "<p>html body</p>",
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      from: FROM,
      to: "user@example.com",
      subject: "Reset your password",
      text: "plain body",
      html: "<p>html body</p>",
    });
  });

  it("resolves without throwing on a 2xx response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 202 }));
    const transport = new ResendTransport(API_KEY, FROM);
    await expect(
      transport.send({ to: "a@b.c", subject: "s", text: "t", html: "h" })
    ).resolves.toBeUndefined();
  });

  it("throws with status + response text on a non-2xx response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("invalid api key", {
        status: 401,
        headers: { "Content-Type": "text/plain" },
      })
    );
    const transport = new ResendTransport(API_KEY, FROM);
    await expect(
      transport.send({ to: "a@b.c", subject: "s", text: "t", html: "h" })
    ).rejects.toThrow(/Resend request failed \(401\).*invalid api key/);
  });

  it("does not leak the outbound message body into the thrown error", async () => {
    // Guards the security-critical comment in resend-transport.ts:
    // "Never include the message body here — it carries the raw token."
    const rawToken = "super-secret-reset-token-abc123";
    fetchSpy.mockResolvedValueOnce(
      new Response("server error", { status: 500 })
    );
    const transport = new ResendTransport(API_KEY, FROM);
    await expect(
      transport.send({
        to: "user@example.com",
        subject: "Reset",
        text: `Reset link: https://example.com/reset?token=${rawToken}`,
        html: `<a href="https://example.com/reset?token=${rawToken}">reset</a>`,
      })
    ).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(rawToken),
      })
    );
  });
});
