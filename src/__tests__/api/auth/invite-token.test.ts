import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError } from "@/lib/errors";

const mockResolveSetupInvite = vi.fn();

vi.mock("@/lib/services/password-reset-service", () => ({
  resolveSetupInvite: (...args: unknown[]) => mockResolveSetupInvite(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { GET } from "@/app/api/auth/invite/[token]/route";

const request = new Request("http://localhost/api/auth/invite/raw-token");

describe("GET /api/auth/invite/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the invite projection for a valid token", async () => {
    mockResolveSetupInvite.mockResolvedValue({
      email: "jane@example.com",
      firstName: "Jane",
      role: "STAFF",
    });

    const response = await GET(request, {
      params: Promise.resolve({ token: "raw-token" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      email: "jane@example.com",
      firstName: "Jane",
      role: "STAFF",
    });
    expect(mockResolveSetupInvite).toHaveBeenCalledWith("raw-token");
  });

  it("returns 404 for an invalid token", async () => {
    mockResolveSetupInvite.mockRejectedValue(
      new NotFoundError("This link is invalid or has expired")
    );

    const response = await GET(request, {
      params: Promise.resolve({ token: "stale" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for an empty token without calling the service", async () => {
    const response = await GET(request, {
      params: Promise.resolve({ token: "" }),
    });

    expect(response.status).toBe(404);
    expect(mockResolveSetupInvite).not.toHaveBeenCalled();
  });
});
