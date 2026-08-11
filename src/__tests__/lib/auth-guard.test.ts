import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetServerSession = vi.fn();
const mockRedirect = vi.fn((_url: string) => {
  throw new Error("__REDIRECT__");
});

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { requireSession } from "@/lib/auth-guard";

describe("requireSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when there is no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("__REDIRECT__");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("returns the session when no role is required", async () => {
    const session = { user: { id: "u1", role: "STAFF", firstName: "Jane" } };
    mockGetServerSession.mockResolvedValue(session);

    await expect(requireSession()).resolves.toBe(session);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns the session when the user's role matches the required single role", async () => {
    const session = {
      user: { id: "u1", role: "GENERAL_MANAGER", firstName: "Jane" },
    };
    mockGetServerSession.mockResolvedValue(session);

    await expect(requireSession("GENERAL_MANAGER")).resolves.toBe(session);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to /bookings when the user's role does not match", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "u1", role: "STAFF", firstName: "Jane" },
    });

    await expect(requireSession("GENERAL_MANAGER")).rejects.toThrow(
      "__REDIRECT__",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/bookings");
  });

  it("accepts an array of allowed roles", async () => {
    const session = { user: { id: "u1", role: "MANAGER", firstName: "Jane" } };
    mockGetServerSession.mockResolvedValue(session);

    await expect(
      requireSession(["MANAGER", "GENERAL_MANAGER"]),
    ).resolves.toBe(session);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
