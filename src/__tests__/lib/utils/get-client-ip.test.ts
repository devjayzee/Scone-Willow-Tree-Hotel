import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/utils/get-client-ip";

// Minimal shim — getClientIp only reads `.headers.get(name)`, so a fake
// Request with a Headers instance is enough.
function buildRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe("getClientIp", () => {
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

  it("falls back to the rightmost x-forwarded-for entry when x-real-ip is missing", () => {
    const req = buildRequest({
      "x-forwarded-for": "attacker-spoof, 10.0.0.1, 203.0.113.7",
    });

    // Rightmost = closest hop, written by the immediate upstream proxy —
    // not the client. Leftmost would be the spoofed value.
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("ignores an attacker-supplied leftmost x-forwarded-for entry (spoof case)", () => {
    // Attacker sets `X-Forwarded-For: 6.6.6.6` per request to rotate the
    // rate-limit key. The proxy appends the real edge IP, so the rightmost
    // is the honest value.
    const req = buildRequest({
      "x-forwarded-for": "6.6.6.6, 203.0.113.7",
    });

    expect(getClientIp(req)).toBe("203.0.113.7");
    expect(getClientIp(req)).not.toBe("6.6.6.6");
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

  it("falls back to 127.0.0.1 when neither header is present", () => {
    const req = buildRequest({});

    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("falls back to 127.0.0.1 when x-forwarded-for is only whitespace/commas", () => {
    const req = buildRequest({ "x-forwarded-for": " , , " });

    expect(getClientIp(req)).toBe("127.0.0.1");
  });
});
