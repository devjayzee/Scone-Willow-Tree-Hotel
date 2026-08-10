import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";

const mockResetPasswordApi = vi.fn();

vi.mock("@/hooks/auth", async () => {
  const { AuthApiError } = await import("@/hooks/auth/auth-api");
  return {
    AuthApiError,
    resetPasswordApi: (...args: unknown[]) => mockResetPasswordApi(...args),
  };
});

import { useResetPasswordForm } from "@/hooks/use-reset-password-form";

const submitEvent = () =>
  ({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);

const STRONG = "NewStr0ng!Pass";

describe("useResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates a valid submit to resetPasswordApi with the token + password", async () => {
    mockResetPasswordApi.mockResolvedValue(undefined);

    const { result } = renderHook(() => useResetPasswordForm("tok"));

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
    expect(mockResetPasswordApi).toHaveBeenCalledWith({
      token: "tok",
      password: STRONG,
    });
  });
});
