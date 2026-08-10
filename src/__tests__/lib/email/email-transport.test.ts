import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const ORIGINAL_ENV = { ...process.env };

async function loadTransportModule() {
  vi.resetModules();
  return await import("@/lib/email/email-transport");
}

describe("email transport selection", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns DevLogTransport in development when env is missing", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const mod = await loadTransportModule();
    const { DevLogTransport } = await import("@/lib/email/dev-transport");
    expect(mod.getEmailTransport()).toBeInstanceOf(DevLogTransport);
  });

  it("returns ResendTransport in development when env is set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "dev@example.com";

    const mod = await loadTransportModule();
    const { ResendTransport } = await import("@/lib/email/resend-transport");
    expect(mod.getEmailTransport()).toBeInstanceOf(ResendTransport);
  });

  it("throws at import time in production when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.EMAIL_FROM = "prod@example.com";

    await expect(loadTransportModule()).rejects.toThrow(/RESEND_API_KEY/);
  });

  it("throws at import time in production when EMAIL_FROM is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.RESEND_API_KEY = "prod-key";

    await expect(loadTransportModule()).rejects.toThrow(/EMAIL_FROM/);
  });

  it("returns ResendTransport in production when both env vars are set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.RESEND_API_KEY = "prod-key";
    process.env.EMAIL_FROM = "prod@example.com";

    const mod = await loadTransportModule();
    const { ResendTransport } = await import("@/lib/email/resend-transport");
    expect(mod.getEmailTransport()).toBeInstanceOf(ResendTransport);
  });
});
