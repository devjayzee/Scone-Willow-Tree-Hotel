import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockFetchInviteToken = vi.fn();
vi.mock("@/hooks/auth/auth-api", () => ({
  fetchInviteToken: (...args: unknown[]) => mockFetchInviteToken(...args),
}));

import { useInviteToken } from "@/hooks/auth/use-invite-token";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useInviteToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the invite for a token", async () => {
    mockFetchInviteToken.mockResolvedValue({
      email: "jane@example.com",
      firstName: "Jane",
      role: "STAFF",
    });

    const { result } = renderHook(() => useInviteToken("tok"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({
      email: "jane@example.com",
      firstName: "Jane",
      role: "STAFF",
    });
    expect(mockFetchInviteToken).toHaveBeenCalledWith("tok");
  });

  it("stays disabled without a token", () => {
    const { result } = renderHook(() => useInviteToken(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchInviteToken).not.toHaveBeenCalled();
  });

  it("surfaces an error for a bad token", async () => {
    mockFetchInviteToken.mockRejectedValue(
      new Error("This invite link is invalid or has expired")
    );

    const { result } = renderHook(() => useInviteToken("stale"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
