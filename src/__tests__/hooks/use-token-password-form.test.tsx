import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";
import { AuthApiError } from "@/hooks/auth/auth-api";
import { useTokenPasswordForm } from "@/hooks/use-token-password-form";

const submitEvent = () =>
  ({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);

const STRONG = "NewStr0ng!Pass";

function fillValid(result: {
  current: ReturnType<typeof useTokenPasswordForm>;
}) {
  act(() => {
    result.current.setPassword(STRONG);
    result.current.setConfirm(STRONG);
  });
}

type SubmitApi = (input: {
  token: string;
  password: string;
}) => Promise<void>;

describe("useTokenPasswordForm", () => {
  let submitApi: ReturnType<typeof vi.fn<SubmitApi>>;

  beforeEach(() => {
    submitApi = vi.fn<SubmitApi>();
  });

  it("isValid stays false until all rules pass and passwords match", () => {
    const { result } = renderHook(() => useTokenPasswordForm("tok", submitApi));

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

  it("does not call submitApi while invalid", async () => {
    const { result } = renderHook(() => useTokenPasswordForm("tok", submitApi));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(submitApi).not.toHaveBeenCalled();
  });

  it("flips done on a successful submit and forwards token + password", async () => {
    submitApi.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTokenPasswordForm("tok", submitApi));
    fillValid(result);

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.done).toBe(true);
    });
    expect(submitApi).toHaveBeenCalledWith({ token: "tok", password: STRONG });
  });

  it("flips invalidToken on a 404 without setting an error banner", async () => {
    submitApi.mockRejectedValue(
      new AuthApiError(404, "This link is invalid or has expired")
    );

    const { result } = renderHook(() =>
      useTokenPasswordForm("stale", submitApi)
    );
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
    submitApi.mockRejectedValue(new AuthApiError(500, "Something broke"));

    const { result } = renderHook(() => useTokenPasswordForm("tok", submitApi));
    fillValid(result);

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Something broke");
    });
    expect(result.current.invalidToken).toBe(false);
  });

  it("falls back to a generic message when the thrown value isn't an Error", async () => {
    submitApi.mockRejectedValue("not-an-error-object");

    const { result } = renderHook(() => useTokenPasswordForm("tok", submitApi));
    fillValid(result);

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Something went wrong");
    });
  });

  it("does not re-submit while isSubmitting", async () => {
    let resolveApi: (() => void) | undefined;
    submitApi.mockImplementation(
      () => new Promise<void>((resolve) => (resolveApi = resolve))
    );

    const { result } = renderHook(() => useTokenPasswordForm("tok", submitApi));
    fillValid(result);

    // First submit — do NOT await, so isSubmitting is true when the second fires
    let first: Promise<void> | undefined;
    act(() => {
      first = result.current.handleSubmit(submitEvent());
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(submitApi).toHaveBeenCalledTimes(1);

    // Release the pending submit so the test doesn't hang
    resolveApi?.();
    await act(async () => {
      await first;
    });
  });
});
