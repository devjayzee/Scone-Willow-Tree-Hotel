import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetLoginPrecheckStatus = vi.fn();
const mockGetClientIp = vi.fn();

vi.mock("@/lib/services/rate-limit-service", () => ({
  getLoginPrecheckStatus: (...args: unknown[]) =>
    mockGetLoginPrecheckStatus(...args),
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

import { RateLimitError } from "@/lib/errors";
import { GET } from "@/app/api/auth/rate-limit-status/route";

describe("GET /api/auth/rate-limit-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIp.mockReturnValue("203.0.113.7");
  });

  it("returns 200 with the service payload on success", async () => {
    mockGetLoginPrecheckStatus.mockResolvedValue({
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

  it("delegates to getLoginPrecheckStatus with the extracted client IP", async () => {
    mockGetLoginPrecheckStatus.mockResolvedValue({
      limited: false,
      remaining: 5,
      resetAt: 0,
    });

    await GET(new NextRequest("http://localhost/api/auth/rate-limit-status"));

    expect(mockGetLoginPrecheckStatus).toHaveBeenCalledWith("203.0.113.7");
  });

  it("returns limited=true when the service says so", async () => {
    mockGetLoginPrecheckStatus.mockResolvedValue({
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

  it("returns 429 RATE_LIMITED when the service's own gate trips (not a fake lockout)", async () => {
    mockGetLoginPrecheckStatus.mockRejectedValue(
      new RateLimitError("Too many requests. Try again shortly."),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/auth/rate-limit-status"),
    );
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.code).toBe("RATE_LIMITED");
    expect(mockGetLoginPrecheckStatus).toHaveBeenCalledWith("203.0.113.7");
  });

  it("returns 500 via handleApiError when the service throws", async () => {
    mockGetLoginPrecheckStatus.mockRejectedValue(new Error("upstream down"));

    const response = await GET(
      new NextRequest("http://localhost/api/auth/rate-limit-status"),
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe("INTERNAL_ERROR");
  });
});
