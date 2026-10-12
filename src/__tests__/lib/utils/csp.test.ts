import { describe, it, expect } from "vitest";
import { getScriptNonceFromHeader } from "next/dist/server/app-render/get-script-nonce-from-header";
import { buildCsp, generateNonce, NONCE_HEADER } from "@/lib/utils/csp";

const NONCE = "AAAAAAAAAAAAAAAAAAAAAA==";

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split("; ").map((d) => {
      const i = d.indexOf(" ");
      return [d.slice(0, i), d.slice(i + 1)] as [string, string];
    }),
  );
}

describe("csp", () => {
  it("exposes the request header name the proxy and layout share", () => {
    expect(NONCE_HEADER).toBe("x-nonce");
  });

  describe("buildCsp", () => {
    it("production script-src is self + nonce + strict-dynamic, no unsafe-inline", () => {
      const scriptSrc = directives(buildCsp({ nonce: NONCE, dev: false })).get(
        "script-src",
      );

      expect(scriptSrc).toBe(`'self' 'nonce-${NONCE}' 'strict-dynamic'`);
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });

    it("dev adds unsafe-eval to script-src and still has no unsafe-inline", () => {
      const scriptSrc = directives(buildCsp({ nonce: NONCE, dev: true })).get(
        "script-src",
      );

      expect(scriptSrc).toBe(
        `'self' 'nonce-${NONCE}' 'strict-dynamic' 'unsafe-eval'`,
      );
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it.each([false, true])(
      "style-src is exactly 'self' 'unsafe-inline' with no nonce (dev=%s)",
      (dev) => {
        const csp = buildCsp({ nonce: NONCE, dev });

        expect(directives(csp).get("style-src")).toBe("'self' 'unsafe-inline'");
        // The only nonce in the whole policy belongs to script-src
        expect(csp.match(/nonce-/g)).toHaveLength(1);
      },
    );

    it("matches the exact production string, in order", () => {
      expect(buildCsp({ nonce: NONCE, dev: false })).toBe(
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
          `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'; ` +
          "font-src 'self' data:; connect-src 'self'; object-src 'none'; " +
          "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    });

    it("connect-src is 'self' only (no upstash)", () => {
      for (const dev of [false, true]) {
        const csp = buildCsp({ nonce: NONCE, dev });
        expect(directives(csp).get("connect-src")).toBe("'self'");
        expect(csp).not.toContain("upstash");
      }
    });

    it("dev differs from production only in script-src", () => {
      const prod = directives(buildCsp({ nonce: NONCE, dev: false }));
      const dev = directives(buildCsp({ nonce: NONCE, dev: true }));
      prod.delete("script-src");
      dev.delete("script-src");

      expect(dev).toEqual(prod);
    });

    it("puts the given nonce in the policy (edge: distinct nonces give distinct policies)", () => {
      expect(buildCsp({ nonce: "AAAA", dev: false })).not.toBe(
        buildCsp({ nonce: "BBBB", dev: false }),
      );
    });
  });

  describe("generateNonce", () => {
    it("is standard base64 that decodes to 16 bytes", () => {
      const nonce = generateNonce();

      expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
      expect(Buffer.from(nonce, "base64")).toHaveLength(16);
    });

    it("differs between calls", () => {
      const nonces = new Set(Array.from({ length: 50 }, () => generateNonce()));

      expect(nonces.size).toBe(50);
    });
  });

  describe("Next round trip", () => {
    it.each([false, true])(
      "getScriptNonceFromHeader recovers the nonce from buildCsp (dev=%s)",
      (dev) => {
        const nonce = generateNonce();

        expect(getScriptNonceFromHeader(buildCsp({ nonce, dev }))).toBe(nonce);
      },
    );
  });
});
