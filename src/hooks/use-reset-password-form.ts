"use client";

import { resetPasswordApi } from "@/hooks/auth";
import { useTokenPasswordForm } from "@/hooks/use-token-password-form";

/**
 * Reset-password form. Thin wrapper over `useTokenPasswordForm` that pins
 * the submit endpoint; UI copy lives in the page.
 */
export function useResetPasswordForm(token: string) {
  return useTokenPasswordForm(token, resetPasswordApi);
}
