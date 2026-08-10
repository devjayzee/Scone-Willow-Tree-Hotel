import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLoggerInfo = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { DevLogTransport } from "@/lib/email/dev-transport";

describe("DevLogTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs subject, to, and text of the message", async () => {
    const transport = new DevLogTransport();
    await transport.send({
      to: "user@example.com",
      subject: "Hello",
      text: "plain body",
      html: "<p>plain body</p>",
    });

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "Email (dev transport — not sent)",
      { to: "user@example.com", subject: "Hello", text: "plain body" }
    );
  });

  it("does not include the html body in the log payload", async () => {
    const transport = new DevLogTransport();
    await transport.send({
      to: "user@example.com",
      subject: "Hello",
      text: "plain",
      html: "<script>alert(1)</script>",
    });

    const payload = mockLoggerInfo.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("html");
    expect(JSON.stringify(payload)).not.toContain("<script>");
  });

  it("resolves without throwing", async () => {
    const transport = new DevLogTransport();
    await expect(
      transport.send({ to: "a@b.c", subject: "s", text: "t", html: "h" })
    ).resolves.toBeUndefined();
  });
});
