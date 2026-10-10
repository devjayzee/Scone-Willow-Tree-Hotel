import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockRefetch = vi.fn();
const mockUseInviteToken = vi.fn();
const mockUseSetupPasswordForm = vi.fn();
let mockToken: string | null = "tok_123";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => mockToken }),
}));

vi.mock("@/hooks/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/auth")>()),
  useInviteToken: (...args: unknown[]) => mockUseInviteToken(...args),
}));

vi.mock("@/hooks/use-setup-password-form", () => ({
  useSetupPasswordForm: (...args: unknown[]) =>
    mockUseSetupPasswordForm(...args),
}));

import { AuthApiError } from "@/hooks/auth";
import SetupPasswordPage from "@/app/(auth)/setup-password/page";

const formState = (overrides: Record<string, unknown> = {}) => ({
  password: "",
  setPassword: vi.fn(),
  confirm: "",
  setConfirm: vi.fn(),
  showPassword: false,
  setShowPassword: vi.fn(),
  isSubmitting: false,
  done: false,
  invalidToken: false,
  error: "",
  passwordsMatch: false,
  isValid: false,
  handleSubmit: vi.fn(),
  ...overrides,
});

const inviteError = (error: Error) => ({
  isError: true,
  isPending: false,
  isFetching: false,
  error,
  data: undefined,
  refetch: mockRefetch,
});

const RETRY_COPY = "Check your connection and try again.";
const OLD_RETRY_SENTENCE = "We couldn't load your invite.";
const INVITE = { firstName: "Ada", email: "ada@example.com", role: "STAFF" };

describe("SetupPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToken = "tok_123";
    mockUseSetupPasswordForm.mockReturnValue(formState());
  });

  // P1
  it("shows the expired screen when the invite lookup returns 404", () => {
    mockUseInviteToken.mockReturnValue(
      inviteError(new AuthApiError(404, "This invite link is invalid or has expired")),
    );

    render(<SetupPasswordPage />);

    expect(screen.getByText("This link has expired")).toBeTruthy();
    expect(screen.queryByText(RETRY_COPY)).toBeNull();
  });

  it("shows the expired screen when there is no token", () => {
    mockToken = null;
    mockUseInviteToken.mockReturnValue({
      isError: false,
      isPending: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<SetupPasswordPage />);

    expect(screen.getByText("This link has expired")).toBeTruthy();
  });

  // P2
  it.each([
    ["429", new AuthApiError(429, "Too many requests")],
    ["500", new AuthApiError(500, "Server error")],
    ["network failure", new TypeError("Failed to fetch")],
  ])("shows a retry state, not the expired screen, on %s", (_n, err) => {
    mockUseInviteToken.mockReturnValue(inviteError(err));

    render(<SetupPasswordPage />);

    expect(screen.queryByText("This link has expired")).toBeNull();
    expect(screen.getByText(RETRY_COPY)).toBeTruthy();
    const back = screen.getByRole("link", { name: "Back to sign in" });
    expect(back.getAttribute("href")).toBe("/login");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // P3
  it("shows the form when the invite loads", () => {
    mockUseInviteToken.mockReturnValue({
      isError: false,
      isPending: false,
      error: null,
      data: { firstName: "Ada", email: "ada@example.com", role: "STAFF" },
      refetch: mockRefetch,
    });

    render(<SetupPasswordPage />);

    expect(screen.getByText("Create your password")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.queryByText("This link has expired")).toBeNull();
  });

  // Older bug: used token + refetch on window focus must not hide success
  it("keeps the success screen when done and a later invite refetch returns 404", () => {
    mockUseInviteToken.mockReturnValue({
      ...inviteError(new AuthApiError(404, "This invite link is invalid or has expired")),
      data: { firstName: "Ada", email: "ada@example.com", role: "STAFF" },
    });
    mockUseSetupPasswordForm.mockReturnValue(formState({ done: true }));

    render(<SetupPasswordPage />);

    expect(screen.getByText("You're all set, Ada")).toBeTruthy();
    expect(screen.queryByText("This link has expired")).toBeNull();
  });

  // Sam Nit 1
  it("disables Try again while the invite is refetching", () => {
    mockUseInviteToken.mockReturnValue({
      ...inviteError(new Error("Failed to fetch")),
      isFetching: true,
    });

    render(<SetupPasswordPage />);

    const retry = screen.getByRole("button", { name: "Try again" });
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(retry);
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("enables Try again and refetches when the invite is not fetching", () => {
    mockUseInviteToken.mockReturnValue(inviteError(new Error("Failed to fetch")));

    render(<SetupPasswordPage />);

    const retry = screen.getByRole("button", { name: "Try again" });
    expect((retry as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(retry);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // Remy N3
  it("gives the retry state a level-1 heading", () => {
    mockUseInviteToken.mockReturnValue(inviteError(new Error("Failed to fetch")));

    render(<SetupPasswordPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Couldn't load your invite" }),
    ).toBeTruthy();
    expect(screen.getByText(RETRY_COPY)).toBeTruthy();
    expect(screen.queryByText(OLD_RETRY_SENTENCE, { exact: false })).toBeNull();
  });

  // Background refetch failure must not replace a loaded form
  it.each([
    ["500", new AuthApiError(500, "Server error")],
    ["429", new AuthApiError(429, "Too many requests")],
    ["network failure", new Error("Failed to fetch")],
  ])("keeps the form when data is present and a refetch fails with %s", (_n, err) => {
    mockUseInviteToken.mockReturnValue({ ...inviteError(err), data: INVITE });

    render(<SetupPasswordPage />);

    expect(screen.getByText("Create your password")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.queryByText(RETRY_COPY)).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Couldn't load your invite" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("shows the expired screen when data is present and a refetch returns 404", () => {
    mockUseInviteToken.mockReturnValue({
      ...inviteError(new AuthApiError(404, "This invite link is invalid or has expired")),
      data: INVITE,
    });

    render(<SetupPasswordPage />);

    expect(screen.getByText("This link has expired")).toBeTruthy();
    expect(screen.queryByText("Create your password")).toBeNull();
  });

  it("shows the expired screen when the submit reports an invalid token (404)", () => {
    mockUseInviteToken.mockReturnValue({
      isError: false,
      isPending: false,
      error: null,
      data: { firstName: "Ada", email: "ada@example.com", role: "STAFF" },
      refetch: mockRefetch,
    });
    mockUseSetupPasswordForm.mockReturnValue(formState({ invalidToken: true }));

    render(<SetupPasswordPage />);

    expect(screen.getByText("This link has expired")).toBeTruthy();
  });
});
