import type {
  LoginRateLimitStatus,
  ResolvedInviteResponse,
} from "@/types/auth";

/**
 * Carries the HTTP status so pages can branch on it (404 → expired-link
 * screen) instead of string-matching the error message. Deviates from the
 * plain `throw new Error(msg)` idiom in booking-api.ts on purpose — only
 * the auth pages need status-based branching.
 */
export class AuthApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

async function throwAuthApiError(
  response: Response,
  fallback: string
): Promise<never> {
  const data = await response.json().catch(() => ({}));
  throw new AuthApiError(response.status, data.error ?? fallback);
}

export async function fetchInviteToken(
  token: string
): Promise<ResolvedInviteResponse> {
  const response = await fetch(
    `/api/auth/invite/${encodeURIComponent(token)}`
  );
  if (!response.ok) {
    await throwAuthApiError(
      response,
      "This invite link is invalid or has expired"
    );
  }
  return response.json();
}

export async function forgotPasswordApi(input: {
  email: string;
}): Promise<void> {
  const response = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await throwAuthApiError(response, "Failed to request a reset link");
  }
}

export async function resetPasswordApi(input: {
  token: string;
  password: string;
}): Promise<void> {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await throwAuthApiError(response, "Failed to reset password");
  }
}

export async function setupPasswordApi(input: {
  token: string;
  password: string;
}): Promise<void> {
  const response = await fetch("/api/auth/setup-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await throwAuthApiError(response, "Failed to set up your password");
  }
}

/**
 * Read-only pre-check consumed by the login form to short-circuit a
 * doomed `signIn` call. Middleware still enforces the actual limit —
 * this is UX sugar, so a plain Error is enough (no status branching).
 */
export async function fetchLoginRateLimitStatus(): Promise<LoginRateLimitStatus> {
  const response = await fetch("/api/auth/rate-limit-status");
  if (!response.ok) {
    throw new Error("Failed to check rate limit");
  }
  return response.json();
}
