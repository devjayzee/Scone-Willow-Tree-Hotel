"use client";

import { useState, type FormEvent } from "react";
import { checkPasswordStrength } from "@/lib/validations/password";
import { AuthApiError, setupPasswordApi } from "@/hooks/auth";

/**
 * First-time password setup form state + submit. Mirrors
 * `useResetPasswordForm`; posts to the setup endpoint which also activates
 * the account.
 */
export function useSetupPasswordForm(token: string) {
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
      await setupPasswordApi({ token, password });
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
