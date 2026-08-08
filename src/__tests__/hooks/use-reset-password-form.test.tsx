import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";

const mockResetPasswordApi = vi.fn();

vi.mock("@/hooks/auth", async () => {
  // Real AuthApiError so the hook's instanceof + status branch is exercised
  const { AuthApiError } = await import("@/hooks/auth/auth-api");
  return {
    AuthApiError,
    resetPasswordApi: (...args: unknown[]) => mockResetPasswordApi(...args),
  };
});

import { AuthApiError } from "@/hooks/auth/auth-api";
import { useResetPasswordForm } from "@/hooks/use-reset-password-form";

const submitEvent = () =>
  ({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);

const STRONG = "NewStr0ng!Pass";

function fillValid(result: {
  current: ReturnType<typeof useResetPasswordForm>;
}) {
  act(() => {
    result.current.setPassword(STRONG);
    result.current.setConfirm(STRONG);
  });
}

describe("useResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isValid stays false until all rules pass and passwords match", () => {
    const { result } = renderHook(() => useResetPasswordForm("tok"));

    expect(result.current.isValid).toBe(false);

    act(() => {
      result.current.setPassword(STRONG);
      result.current.setConfirm("different");
    });
    expect(result.current.passwordsMatch).toBe(false);
    expect(result.current.isValid).toBe(false);

    act(() => {
      result.current.setConfirm(STRONG);
    });
    expect(result.current.passwordsMatch).toBe(true);
    expect(result.current.isValid).toBe(true);
  });

  it("does not submit while invalid", async () => {
    const { result } = renderHook(() => useResetPasswordForm("tok"));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mockResetPasswordApi).not.toHaveBeenCalled();
  });

  it("flips done on a successful submit", async () => {
    mockResetPasswordApi.mockResolvedValue(undefined);

    const { result } = renderHook(() => useResetPasswordForm("tok"));
    fillValid(result);

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });
    expect(mockResetPasswordApi).toHaveBeenCalledWith({
      token: "tok",
      password: STRONG,
    });
  });

  it("flips invalidToken on a 404 without setting an error banner", async () => {
    mockResetPasswordApi.mockRejectedValue(
      new AuthApiError(404, "This link is invalid or has expired")
    );

    const { result } = renderHook(() => useResetPasswordForm("stale"));
    fillValid(result);

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.invalidToken).toBe(true);
    });
    expect(result.current.error).toBe("");
    expect(result.current.done).toBe(false);
  });

  it("sets the error banner for non-404 failures", async () => {
    mockResetPasswordApi.mockRejectedValue(
      new AuthApiError(500, "Something broke")
    );

    const { result } = renderHook(() => useResetPasswordForm("tok"));
    fillValid(result);

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Something broke");
    });
    expect(result.current.invalidToken).toBe(false);
  });
});
