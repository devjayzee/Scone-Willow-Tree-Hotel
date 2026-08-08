import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";

const mockSetupPasswordApi = vi.fn();

vi.mock("@/hooks/auth", async () => {
  const { AuthApiError } = await import("@/hooks/auth/auth-api");
  return {
    AuthApiError,
    setupPasswordApi: (...args: unknown[]) => mockSetupPasswordApi(...args),
  };
});

import { AuthApiError } from "@/hooks/auth/auth-api";
import { useSetupPasswordForm } from "@/hooks/use-setup-password-form";

const submitEvent = () =>
  ({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);

const STRONG = "NewStr0ng!Pass";

describe("useSetupPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flips done on a successful submit", async () => {
    mockSetupPasswordApi.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSetupPasswordForm("tok"));

    act(() => {
      result.current.setPassword(STRONG);
      result.current.setConfirm(STRONG);
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });
    expect(mockSetupPasswordApi).toHaveBeenCalledWith({
      token: "tok",
      password: STRONG,
    });
  });

  it("flips invalidToken on a 404", async () => {
    mockSetupPasswordApi.mockRejectedValue(
      new AuthApiError(404, "This link is invalid or has expired")
    );

    const { result } = renderHook(() => useSetupPasswordForm("stale"));

    act(() => {
      result.current.setPassword(STRONG);
      result.current.setConfirm(STRONG);
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.invalidToken).toBe(true);
    });
    expect(result.current.error).toBe("");
  });

  it("does not submit while passwords mismatch", async () => {
    const { result } = renderHook(() => useSetupPasswordForm("tok"));

    act(() => {
      result.current.setPassword(STRONG);
      result.current.setConfirm("other");
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mockSetupPasswordApi).not.toHaveBeenCalled();
  });
});
