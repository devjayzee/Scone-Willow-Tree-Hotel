import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/utils/get-client-ip";

const ORIGINAL_VERCEL = process.env.VERCEL;

// Minimal shim — getClientIp only reads `.headers.get(name)`, so a fake
// Request with a Headers instance is enough.
function buildRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe("getClientIp", () => {
  beforeEach(() => {
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (ORIGINAL_VERCEL === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = ORIGINAL_VERCEL;
    }
  });

  describe("on Vercel (process.env.VERCEL === '1')", () => {
    beforeEach(() => {
      process.env.VERCEL = "1";
    });

    it("returns x-real-ip when present (Vercel-injected, trusted)", () => {
      const req = buildRequest({
        "x-real-ip": "203.0.113.7",
        "x-forwarded-for": "1.1.1.1, 203.0.113.7",
      });

      expect(getClientIp(req)).toBe("203.0.113.7");
    });

    it("trims whitespace from x-real-ip", () => {
      const req = buildRequest({ "x-real-ip": "  203.0.113.7  " });

      expect(getClientIp(req)).toBe("203.0.113.7");
    });

    it("falls back to rightmost x-forwarded-for when x-real-ip is absent", () => {
      const req = buildRequest({
        "x-forwarded-for": "attacker-spoof, 10.0.0.1, 203.0.113.7",
      });

      expect(getClientIp(req)).toBe("203.0.113.7");
    });
  });

  describe("off Vercel (VERCEL unset)", () => {
    it("IGNORES x-real-ip — attacker-controllable off the Vercel edge", () => {
      // Both headers present; x-real-ip must be discarded so a client
      // can't spoof a rate-limit-key of their choosing.
      const req = buildRequest({
        "x-real-ip": "203.0.113.99",
        "x-forwarded-for": "1.1.1.1, 10.0.0.1",
      });

      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("uses rightmost x-forwarded-for entry", () => {
      const req = buildRequest({
        "x-forwarded-for": "attacker-spoof, 10.0.0.1, 203.0.113.7",
      });

      expect(getClientIp(req)).toBe("203.0.113.7");
    });

    it("ignores leftmost (attacker-supplied) x-forwarded-for entry", () => {
      const req = buildRequest({
        "x-forwarded-for": "6.6.6.6, 203.0.113.7",
      });

      expect(getClientIp(req)).toBe("203.0.113.7");
    });

    it("handles a single-entry x-forwarded-for", () => {
      const req = buildRequest({ "x-forwarded-for": "203.0.113.7" });

      expect(getClientIp(req)).toBe("203.0.113.7");
    });

    it("skips empty entries in x-forwarded-for", () => {
      const req = buildRequest({
        "x-forwarded-for": "6.6.6.6, ,  , 203.0.113.7,",
      });

      expect(getClientIp(req)).toBe("203.0.113.7");
    });

    it("falls back to 127.0.0.1 when neither header is present (local dev)", () => {
      const req = buildRequest({});

      expect(getClientIp(req)).toBe("127.0.0.1");
    });

    it("falls back to 127.0.0.1 when only x-real-ip is set (would spoof)", () => {
      const req = buildRequest({ "x-real-ip": "203.0.113.99" });

      expect(getClientIp(req)).toBe("127.0.0.1");
    });

    it("falls back to 127.0.0.1 when x-forwarded-for is only whitespace/commas", () => {
      const req = buildRequest({ "x-forwarded-for": " , , " });

      expect(getClientIp(req)).toBe("127.0.0.1");
    });
  });
});
