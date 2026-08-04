import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetLoginRateLimitStatus = vi.fn();
const mockGetClientIp = vi.fn();

vi.mock("@/lib/services/rate-limit-service", () => ({
  getLoginRateLimitStatus: (...args: unknown[]) =>
    mockGetLoginRateLimitStatus(...args),
}));

vi.mock("@/lib/utils/get-client-ip", () => ({
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "@/app/api/auth/rate-limit-status/route";

describe("GET /api/auth/rate-limit-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIp.mockReturnValue("203.0.113.7");
  });

  it("returns 200 with the service payload on success", async () => {
    mockGetLoginRateLimitStatus.mockResolvedValue({
      limited: false,
      remaining: 3,
      resetAt: 1_800_000,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/auth/rate-limit-status"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ limited: false, remaining: 3, resetAt: 1_800_000 });
  });

  it("forwards the extracted client IP into the service", async () => {
    mockGetLoginRateLimitStatus.mockResolvedValue({
      limited: false,
      remaining: 5,
      resetAt: 0,
    });

    await GET(new NextRequest("http://localhost/api/auth/rate-limit-status"));

    expect(mockGetLoginRateLimitStatus).toHaveBeenCalledWith("203.0.113.7");
  });

  it("returns limited=true when the service says so", async () => {
    mockGetLoginRateLimitStatus.mockResolvedValue({
      limited: true,
      remaining: 0,
      resetAt: 2_700_000,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/auth/rate-limit-status"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.limited).toBe(true);
  });

  it("returns 500 via handleApiError when the service throws", async () => {
    mockGetLoginRateLimitStatus.mockRejectedValue(new Error("upstream down"));

    const response = await GET(
      new NextRequest("http://localhost/api/auth/rate-limit-status"),
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe("INTERNAL_ERROR");
  });
});
