import { describe, it, expect } from "vitest";
import { buildCsp } from "@/lib/security/csp";

describe("buildCsp", () => {
  const NONCE = "test-nonce-abc123";

  describe("prod", () => {
    it("puts nonce + strict-dynamic in script-src and drops unsafe-inline", () => {
      const csp = buildCsp({ nonce: NONCE, dev: false });

      expect(csp).toContain(
        `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'`,
      );
      // Sanity check: unsafe-inline must not appear inside script-src.
      const scriptSrcDirective = csp
        .split(";")
        .map((s) => s.trim())
        .find((d) => d.startsWith("script-src"))!;
      expect(scriptSrcDirective).not.toContain("'unsafe-inline'");
      expect(scriptSrcDirective).not.toContain("'unsafe-eval'");
    });

    it("keeps object-src 'none' (M6 tightening from #188)", () => {
      const csp = buildCsp({ nonce: NONCE, dev: false });
      expect(csp).toContain("object-src 'none'");
    });

    it("keeps frame-ancestors 'none'", () => {
      expect(buildCsp({ nonce: NONCE, dev: false })).toContain(
        "frame-ancestors 'none'",
      );
    });

    it("keeps the connect-src allowlist for Upstash", () => {
      expect(buildCsp({ nonce: NONCE, dev: false })).toContain(
        "connect-src 'self' https://*.upstash.io",
      );
    });

    it("keeps unsafe-inline on style-src (Radix / react-big-calendar)", () => {
      // style-src is a separate directive; unsafe-inline is required
      // by shadcn/Radix primitives and react-big-calendar. This test
      // pins that we did NOT accidentally tighten style-src while
      // tightening script-src.
      expect(buildCsp({ nonce: NONCE, dev: false })).toContain(
        "style-src 'self' 'unsafe-inline'",
      );
    });
  });

  describe("dev", () => {
    it("keeps the permissive script-src (React Refresh needs eval)", () => {
      const csp = buildCsp({ nonce: NONCE, dev: true });

      expect(csp).toContain(
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      );
      expect(csp).not.toContain("nonce-");
      expect(csp).not.toContain("strict-dynamic");
    });

    it("otherwise matches prod (all other directives)", () => {
      const dev = buildCsp({ nonce: NONCE, dev: true });
      const prod = buildCsp({ nonce: NONCE, dev: false });

      const nonScriptDev = dev
        .split(";")
        .map((s) => s.trim())
        .filter((d) => !d.startsWith("script-src"));
      const nonScriptProd = prod
        .split(";")
        .map((s) => s.trim())
        .filter((d) => !d.startsWith("script-src"));

      expect(nonScriptDev).toEqual(nonScriptProd);
    });
  });

  it("emits a semicolon-separated single-line header", () => {
    const csp = buildCsp({ nonce: NONCE, dev: false });
    expect(csp).not.toContain("\n");
    // At least 10 directives (default, img, style, script, font,
    // connect, object, frame-ancestors, base, form-action).
    expect(csp.split(";").length).toBeGreaterThanOrEqual(10);
  });
});
