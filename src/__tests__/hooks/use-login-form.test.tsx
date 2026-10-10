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

vi.mock("@/hooks/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/auth")>()),
  fetchLoginRateLimitStatus: (...args: unknown[]) => mockFetchStatus(...args),
}));

import { AuthApiError } from "@/hooks/auth";
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
    expect(result.current.rememberDevice).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("sets lockedUntil from resetAt and skips signIn when rate-limited", async () => {
    const resetAt = Date.now() + 60_000;
    mockFetchStatus.mockResolvedValue({
      limited: true,
      remaining: 0,
      resetAt,
    });

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.lockedUntil).toBe(resetAt);
    });
    expect(result.current.remaining).toBe(0);
    expect(result.current.error).toBe("");
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("computes remaining from the follow-up status call after a failed signIn", async () => {
    mockFetchStatus
      .mockResolvedValueOnce({ limited: false, remaining: 4, resetAt: 0 })
      .mockResolvedValueOnce({ limited: false, remaining: 3, resetAt: 0 });
    mockSignIn.mockResolvedValue({ error: "Invalid email or password" });

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.remaining).toBe(3);
    });
    expect(result.current.error).toBe("Invalid email or password");
    expect(result.current.lockedUntil).toBeNull();
    expect(mockFetchStatus).toHaveBeenCalledTimes(2);
  });

  it("flips to lockout when the failed attempt consumed the last token", async () => {
    const resetAt = Date.now() + 60_000;
    mockFetchStatus
      .mockResolvedValueOnce({ limited: false, remaining: 1, resetAt: 0 })
      .mockResolvedValueOnce({ limited: true, remaining: 0, resetAt });
    mockSignIn.mockResolvedValue({ error: "Invalid email or password" });

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.lockedUntil).toBe(resetAt);
    });
    expect(result.current.remaining).toBe(0);
    expect(result.current.error).toBe("");
  });

  it("maps the limiter-disabled sentinel (remaining >= 999) to null", async () => {
    mockFetchStatus.mockResolvedValue({
      limited: false,
      remaining: 999,
      resetAt: 0,
    });
    mockSignIn.mockResolvedValue({ error: "Invalid email or password" });

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Invalid email or password");
    });
    expect(result.current.remaining).toBeNull();
  });

  it("clearLockout resets lockedUntil and remaining to null", async () => {
    const resetAt = Date.now() + 60_000;
    mockFetchStatus.mockResolvedValue({
      limited: true,
      remaining: 0,
      resetAt,
    });

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.lockedUntil).toBe(resetAt);
    });

    act(() => {
      result.current.clearLockout();
    });

    expect(result.current.lockedUntil).toBeNull();
    expect(result.current.remaining).toBeNull();
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
      remember: "0",
      redirect: false,
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("passes remember: '1' to signIn when the checkbox is on", async () => {
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
      result.current.setRememberDevice(true);
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "correct",
      remember: "1",
      redirect: false,
    });
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

  describe("best-effort pre-check", () => {
    const fill = (result: { current: ReturnType<typeof useLoginForm> }) =>
      act(() => {
        result.current.setEmail("user@example.com");
        result.current.setPassword("correct");
      });

    // L1
    it.each([
      ["network failure", new TypeError("Failed to fetch")],
      ["429 response", new AuthApiError(429, "Too many requests")],
      ["500 response", new AuthApiError(500, "Server error")],
    ])("still calls signIn and navigates when the pre-check fails (%s)", async (_n, err) => {
      mockFetchStatus.mockRejectedValue(err);
      mockSignIn.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(mockSignIn).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith("/bookings");
      });
      expect(result.current.error).toBe("");
      expect(result.current.lockedUntil).toBeNull();
    });

    // L2
    it("calls signIn with no lockout when the pre-check says limited with resetAt 0", async () => {
      mockFetchStatus.mockResolvedValueOnce({
        limited: true,
        remaining: 0,
        resetAt: 0,
      });
      mockSignIn.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(mockSignIn).toHaveBeenCalledTimes(1);
      expect(result.current.lockedUntil).toBeNull();
      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith("/bookings");
      });
    });

    // L3
    it("shows the lockout and skips signIn when limited with a future resetAt", async () => {
      const resetAt = Date.now() + 60_000;
      mockFetchStatus.mockResolvedValue({ limited: true, remaining: 0, resetAt });

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(result.current.lockedUntil).toBe(resetAt);
      expect(result.current.error).toBe("");
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    // L4
    it("shows the sign-in error, with no remaining count, when the follow-up status fetch fails", async () => {
      mockFetchStatus
        .mockResolvedValueOnce({ limited: false, remaining: 4, resetAt: 0 })
        .mockRejectedValueOnce(new AuthApiError(429, "Too many requests"));
      mockSignIn.mockResolvedValue({ error: "Invalid email or password" });

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(result.current.error).toBe("Invalid email or password");
      expect(result.current.remaining).toBeNull();
      expect(result.current.lockedUntil).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    // L5
    it("applies the lockout when the follow-up status reports a real one", async () => {
      const resetAt = Date.now() + 60_000;
      mockFetchStatus
        .mockResolvedValueOnce({ limited: false, remaining: 1, resetAt: 0 })
        .mockResolvedValueOnce({ limited: true, remaining: 0, resetAt });
      mockSignIn.mockResolvedValue({ error: "Invalid email or password" });

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(result.current.lockedUntil).toBe(resetAt);
      expect(result.current.remaining).toBe(0);
      expect(result.current.error).toBe("");
    });

    // Remy S1: a count from an earlier submit must not outlive a later failure
    it("clears a stale remaining count when a later follow-up status fetch fails", async () => {
      const future = Date.now() + 60_000;
      mockFetchStatus
        // submit 1: pre-check, then follow-up with a count
        .mockResolvedValueOnce({ limited: false, remaining: 5, resetAt: 0 })
        .mockResolvedValueOnce({ limited: false, remaining: 4, resetAt: future })
        // submit 2: pre-check ok, follow-up rejects
        .mockResolvedValueOnce({ limited: false, remaining: 4, resetAt: 0 })
        .mockRejectedValueOnce(new Error("Failed to check rate limit"));
      mockSignIn.mockResolvedValue({ error: "Invalid email or password" });

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(result.current.remaining).toBe(4);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(result.current.remaining).toBeNull();
      expect(result.current.error).toBe("Invalid email or password");
    });

    it("clears a stale remaining count when signIn throws on a later submit", async () => {
      mockFetchStatus
        .mockResolvedValueOnce({ limited: false, remaining: 5, resetAt: 0 })
        .mockResolvedValueOnce({ limited: false, remaining: 4, resetAt: 0 })
        .mockResolvedValueOnce({ limited: false, remaining: 4, resetAt: 0 });
      mockSignIn
        .mockResolvedValueOnce({ error: "Invalid email or password" })
        .mockRejectedValueOnce(new Error("network down"));

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(result.current.remaining).toBe(4);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(result.current.remaining).toBeNull();
      expect(result.current.error).toBe("An unexpected error occurred");
    });

    // Remy N5: the real fetchLoginRateLimitStatus throws a plain Error on !ok
    it("still calls signIn and navigates when the pre-check throws the real plain Error", async () => {
      mockFetchStatus.mockRejectedValue(new Error("Failed to check rate limit"));
      mockSignIn.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(mockSignIn).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith("/bookings");
      });
      expect(result.current.error).toBe("");
      expect(result.current.lockedUntil).toBeNull();
    });

    it("shows the sign-in error and no count when the follow-up throws the real plain Error", async () => {
      mockFetchStatus
        .mockResolvedValueOnce({ limited: false, remaining: 4, resetAt: 0 })
        .mockRejectedValueOnce(new Error("Failed to check rate limit"));
      mockSignIn.mockResolvedValue({ error: "Invalid email or password" });

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(result.current.error).toBe("Invalid email or password");
      expect(result.current.remaining).toBeNull();
    });

    it("sets a generic error when signIn itself throws", async () => {
      mockFetchStatus.mockResolvedValue({ limited: false, remaining: 5, resetAt: 0 });
      mockSignIn.mockRejectedValue(new Error("network down"));

      const { result } = renderHook(() => useLoginForm());
      fill(result);

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(result.current.error).toBe("An unexpected error occurred");
      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });
});
