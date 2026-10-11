import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEVICE_COOKIE_NAME,
  DEVICE_COOKIE_OPTIONS,
  findTrustedDevice,
  issueDeviceCookie,
} from "@/lib/utils/device-cookie";

// In-memory jar standing in for next/headers cookies(), as in auth.test.ts.
const cookieJar = new Map<string, string>();
const mockCookieSet = vi.fn();
const jarState = { setThrows: false, cookiesRejects: false };
vi.mock("next/headers", () => ({
  cookies: async () => {
    if (jarState.cookiesRejects) throw new Error("no request scope");
    return {
      get: (name: string) =>
        cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
      set: (name: string, value: string, options: unknown) => {
        mockCookieSet(name, value, options);
        if (jarState.setThrows) throw new Error("headers already sent");
        cookieJar.set(name, value);
      },
    };
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { trustCompletingBrowser } from "@/lib/utils/trust-browser";
import { logger } from "@/lib/logger";

const EMAIL = "jane@example.com";
const V = 1_800_000_000;

describe("trustCompletingBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();
    jarState.setThrows = false;
    jarState.cookiesRejects = false;
    // Fake only Date so the entries minted here sit inside the validity window.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime((V + 30) * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets the device cookie with the agreed name and options", async () => {
    await trustCompletingBrowser(EMAIL, V);

    expect(mockCookieSet).toHaveBeenCalledTimes(1);
    expect(mockCookieSet).toHaveBeenCalledWith(
      DEVICE_COOKIE_NAME,
      expect.any(String),
      DEVICE_COOKIE_OPTIONS,
    );
  });

  it("writes an entry with iat = validAfter + 1 for the normalized email", async () => {
    await trustCompletingBrowser("  Jane@Example.COM ", V);

    const value = mockCookieSet.mock.calls[0][1] as string;
    expect(findTrustedDevice(value, EMAIL, V + 30)?.iat).toBe(V + 1);
    expect(value).not.toContain("jane@");
  });

  it("keeps an existing valid entry in the browser's cookie", async () => {
    const other = "other@example.com";
    cookieJar.set(DEVICE_COOKIE_NAME, issueDeviceCookie(undefined, other, V - 10));

    await trustCompletingBrowser(EMAIL, V);

    const value = mockCookieSet.mock.calls[0][1] as string;
    expect(findTrustedDevice(value, EMAIL, V + 30)?.iat).toBe(V + 1);
    expect(findTrustedDevice(value, other, V + 30)?.iat).toBe(V - 10);
  });

  it("keeps the browser's own nonce for the email and refreshes its iat", async () => {
    cookieJar.set(DEVICE_COOKIE_NAME, issueDeviceCookie(undefined, EMAIL, V - 10));
    const oldNonce = findTrustedDevice(cookieJar.get(DEVICE_COOKIE_NAME), EMAIL, V)
      ?.nonce;

    await trustCompletingBrowser(EMAIL, V);

    const found = findTrustedDevice(mockCookieSet.mock.calls[0][1], EMAIL, V + 30);
    expect(found?.nonce).toBe(oldNonce);
    expect(found?.iat).toBe(V + 1);
  });

  it("uses the current second when validAfter is null", async () => {
    await trustCompletingBrowser(EMAIL, null);

    const value = mockCookieSet.mock.calls[0][1] as string;
    expect(findTrustedDevice(value, EMAIL, V + 30)?.iat).toBe(V + 30);
  });

  it("resolves and logs a warning when jar.set throws", async () => {
    jarState.setThrows = true;

    await expect(trustCompletingBrowser(EMAIL, V)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("resolves and logs a warning when cookies() rejects", async () => {
    jarState.cookiesRejects = true;

    await expect(trustCompletingBrowser(EMAIL, V)).resolves.toBeUndefined();

    expect(mockCookieSet).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
