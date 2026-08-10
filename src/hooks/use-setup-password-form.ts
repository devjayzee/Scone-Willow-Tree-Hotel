"use client";

import { setupPasswordApi } from "@/hooks/auth";
import { useTokenPasswordForm } from "@/hooks/use-token-password-form";

/**
 * First-time password setup form. Thin wrapper over
 * `useTokenPasswordForm` that pins the setup endpoint (which also
 * activates the account).
 */
export function useSetupPasswordForm(token: string) {
  return useTokenPasswordForm(token, setupPasswordApi);
}
