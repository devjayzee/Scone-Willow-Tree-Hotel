import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadAppUrlModule() {
  vi.resetModules();
  return await import("@/lib/email/app-url");
}

describe("email APP_BASE_URL", () => {
  beforeEach(() => {
    delete process.env.NEXTAUTH_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("throws at import time when NEXTAUTH_URL is missing", async () => {
    await expect(loadAppUrlModule()).rejects.toThrow(/NEXTAUTH_URL is required/);
  });

  it("exports the raw value when it's already trimmed of trailing slashes", async () => {
    process.env.NEXTAUTH_URL = "https://willowtree.example";
    const mod = await loadAppUrlModule();
    expect(mod.APP_BASE_URL).toBe("https://willowtree.example");
  });

  it("strips a single trailing slash", async () => {
    process.env.NEXTAUTH_URL = "https://willowtree.example/";
    const mod = await loadAppUrlModule();
    expect(mod.APP_BASE_URL).toBe("https://willowtree.example");
  });

  it("strips multiple trailing slashes", async () => {
    process.env.NEXTAUTH_URL = "https://willowtree.example///";
    const mod = await loadAppUrlModule();
    expect(mod.APP_BASE_URL).toBe("https://willowtree.example");
  });
});
