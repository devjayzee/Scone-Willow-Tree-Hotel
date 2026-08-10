"use client";

import { useState, type FormEvent } from "react";
import { forgotPasswordApi } from "@/hooks/auth";

// claude-allow: rule-5 — auth surface intentionally bypasses TanStack Query.
// One-shot form submit against a public unauthenticated endpoint with no
// cache/invalidation surface (nothing to refetch, no cross-hook sharing).
// A useMutation wrapper would add ceremony without buying anything.
// Decision approved in the #127 auth-redesign thread.
/**
 * Forgot-password form state + submit. `sent` flips on 200 regardless of
 * whether the email exists — the API never reveals account existence.
 */
export function useForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await forgotPasswordApi({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return { email, setEmail, isLoading, sent, error, handleSubmit };
}
