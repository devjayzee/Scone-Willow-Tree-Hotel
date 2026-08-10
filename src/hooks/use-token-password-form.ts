"use client";

import { useState, type FormEvent } from "react";
import { checkPasswordStrength } from "@/lib/validations/password";
import { AuthApiError } from "@/hooks/auth";

// claude-allow: rule-5 — auth surface intentionally bypasses TanStack Query.
// One-shot form submits against public unauthenticated endpoints with no
// cache/invalidation surface. The 404 → invalidToken branch is form-local
// state, not server state worth caching. A useMutation wrapper would add
// ceremony without buying anything. Decision approved in the #127
// auth-redesign thread.
/**
 * Shared token-and-password form engine for `useResetPasswordForm` and
 * `useSetupPasswordForm`. The two flows differ only in which API endpoint
 * they hit (submitApi) and their UI copy — the state machine, validity
 * rules, and 404-vs-error branching are identical.
 */
export function useTokenPasswordForm(
  token: string,
  submitApi: (input: { token: string; password: string }) => Promise<void>
) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const [error, setError] = useState("");

  const passwordsMatch = password.length > 0 && password === confirm;
  const isValid = checkPasswordStrength(password).isValid && passwordsMatch;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      await submitApi({ token, password });
      setDone(true);
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 404) {
        setInvalidToken(true);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    password,
    setPassword,
    confirm,
    setConfirm,
    showPassword,
    setShowPassword,
    isSubmitting,
    done,
    invalidToken,
    error,
    passwordsMatch,
    isValid,
    handleSubmit,
  };
}
