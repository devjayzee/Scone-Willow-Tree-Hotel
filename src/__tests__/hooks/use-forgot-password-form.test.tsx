import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";

const mockForgotPasswordApi = vi.fn();

vi.mock("@/hooks/auth", () => ({
  forgotPasswordApi: (...args: unknown[]) => mockForgotPasswordApi(...args),
}));

import { useForgotPasswordForm } from "@/hooks/use-forgot-password-form";

const submitEvent = () =>
  ({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);

describe("useForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flips sent on a successful submit and trims the email", async () => {
    mockForgotPasswordApi.mockResolvedValue(undefined);

    const { result } = renderHook(() => useForgotPasswordForm());

    act(() => {
      result.current.setEmail("  jane@example.com  ");
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.sent).toBe(true);
    });
    expect(mockForgotPasswordApi).toHaveBeenCalledWith({
      email: "jane@example.com",
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("surfaces the error message and stays on the form when the API fails", async () => {
    mockForgotPasswordApi.mockRejectedValue(
      new Error("Too many reset requests. Try again later.")
    );

    const { result } = renderHook(() => useForgotPasswordForm());

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.error).toBe(
        "Too many reset requests. Try again later."
      );
    });
    expect(result.current.sent).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});
