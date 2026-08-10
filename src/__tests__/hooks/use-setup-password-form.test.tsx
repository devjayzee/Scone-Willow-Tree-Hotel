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

import { useSetupPasswordForm } from "@/hooks/use-setup-password-form";

const submitEvent = () =>
  ({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);

const STRONG = "NewStr0ng!Pass";

describe("useSetupPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates a valid submit to setupPasswordApi with the token + password", async () => {
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
});
