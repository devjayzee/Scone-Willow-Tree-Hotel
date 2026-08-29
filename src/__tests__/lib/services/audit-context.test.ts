import { describe, it, expect } from "vitest";
import {
  runWithAuditContext,
  getAuditContext,
} from "@/lib/services/audit-context";

describe("audit-context", () => {
  it("returns undefined outside a runWithAuditContext boundary", () => {
    expect(getAuditContext()).toBeUndefined();
  });

  it("makes the context available inside the boundary", async () => {
    const ctx = { ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0 test" };

    await runWithAuditContext(ctx, async () => {
      expect(getAuditContext()).toEqual(ctx);
    });
  });

  it("returns the boundary's own result", async () => {
    const result = await runWithAuditContext({ ipAddress: "10.0.0.1" }, async () => {
      return "done";
    });

    expect(result).toBe("done");
  });

  it("clears the context after the boundary exits", async () => {
    await runWithAuditContext({ ipAddress: "10.0.0.1" }, async () => {});

    expect(getAuditContext()).toBeUndefined();
  });

  it("propagates the context to nested async calls within the same boundary", async () => {
    async function nested() {
      return getAuditContext();
    }

    const ctx = { ipAddress: "198.51.100.1" };
    const seen = await runWithAuditContext(ctx, async () => {
      return nested();
    });

    expect(seen).toEqual(ctx);
  });

  it("isolates context across concurrent boundaries", async () => {
    const [a, b] = await Promise.all([
      runWithAuditContext({ ipAddress: "1.1.1.1" }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return getAuditContext();
      }),
      runWithAuditContext({ ipAddress: "2.2.2.2" }, async () => {
        return getAuditContext();
      }),
    ]);

    expect(a).toEqual({ ipAddress: "1.1.1.1" });
    expect(b).toEqual({ ipAddress: "2.2.2.2" });
  });
});
