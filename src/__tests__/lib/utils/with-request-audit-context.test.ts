import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetClientIp = vi.fn();

vi.mock("@/lib/utils/get-client-ip", () => ({
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}));

import { withRequestAuditContext } from "@/lib/utils/with-request-audit-context";
import { getAuditContext } from "@/lib/services/audit-context";

describe("withRequestAuditContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("makes the client IP and user-agent available via getAuditContext inside the boundary", async () => {
    mockGetClientIp.mockReturnValue("203.0.113.7");
    const req = new Request("https://example.com", {
      headers: { "user-agent": "Mozilla/5.0 test" },
    });

    let seen;
    await withRequestAuditContext(req, async () => {
      seen = getAuditContext();
    });

    expect(mockGetClientIp).toHaveBeenCalledWith(req);
    expect(seen).toEqual({
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0 test",
    });
  });

  it("sets userAgent to undefined when the header is absent", async () => {
    mockGetClientIp.mockReturnValue("203.0.113.7");
    const req = new Request("https://example.com");

    let seen;
    await withRequestAuditContext(req, async () => {
      seen = getAuditContext();
    });

    expect(seen).toEqual({ ipAddress: "203.0.113.7", userAgent: undefined });
  });

  it("returns the handler's own result", async () => {
    mockGetClientIp.mockReturnValue("203.0.113.7");
    const req = new Request("https://example.com");

    const result = await withRequestAuditContext(req, async () => "handled");

    expect(result).toBe("handled");
  });
});
