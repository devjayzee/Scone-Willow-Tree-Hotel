import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";

const mockSignIn = vi.fn();
const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();
const mockFetchStatus = vi.fn();

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    refresh: mockRouterRefresh,
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  fetchLoginRateLimitStatus: (...args: unknown[]) => mockFetchStatus(...args),
}));

import { useLoginForm } from "@/hooks/use-login-form";

// Minimal FormEvent stub — the hook only calls preventDefault().
const submitEvent = () =>
  ({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);

describe("useLoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initial state has empty fields and no loading/error", () => {
    mockFetchStatus.mockResolvedValue({
      limited: false,
      remaining: 5,
      resetAt: 0,
    });

    const { result } = renderHook(() => useLoginForm());

    expect(result.current.email).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("sets a friendly error and skips signIn when rate-limited", async () => {
    mockFetchStatus.mockResolvedValue({
      limited: true,
      remaining: 0,
      resetAt: 0,
    });

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.error).toMatch(/Too many login attempts/);
    });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces the signIn error message when credentials are wrong", async () => {
    mockFetchStatus.mockResolvedValue({
      limited: false,
      remaining: 5,
      resetAt: 0,
    });
    mockSignIn.mockResolvedValue({ error: "Invalid email or password" });

    const { result } = renderHook(() => useLoginForm());

    act(() => {
      result.current.setEmail("user@example.com");
      result.current.setPassword("wrong");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Invalid email or password");
    });
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "wrong",
      redirect: false,
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("navigates to /bookings on successful signIn", async () => {
    mockFetchStatus.mockResolvedValue({
      limited: false,
      remaining: 5,
      resetAt: 0,
    });
    mockSignIn.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useLoginForm());

    act(() => {
      result.current.setEmail("user@example.com");
      result.current.setPassword("correct");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/bookings");
    });
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("");
  });

  it("sets a generic error when the pre-check fetch throws", async () => {
    mockFetchStatus.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.error).toBe("An unexpected error occurred");
    });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
