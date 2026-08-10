"use client";

import { useCallback, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchLoginRateLimitStatus } from "@/hooks/auth";

/** remaining >= this sentinel means the limiter is disabled (see rate-limit-service). */
const LIMITER_DISABLED_REMAINING = 999;

// claude-allow: rule-5 — auth surface intentionally bypasses TanStack Query.
// Login runs pre-session against next-auth's signIn (not a normal API
// mutation), with a rate-limit pre-check as UX sugar. Nothing to cache,
// nothing to invalidate — a useMutation wrapper would add ceremony without
// buying anything. Decision approved in the #127 auth-redesign thread.
/**
 * Login form state + submit orchestration. Page becomes presentational.
 */
export function useLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const clearLockout = useCallback(() => {
    setLockedUntil(null);
    setRemaining(null);
  }, []);

  const applyLockout = (resetAt: number) => {
    setLockedUntil(resetAt);
    setRemaining(0);
    // The locked-out screen replaces the form; a stale banner would double up.
    setError("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const rateLimit = await fetchLoginRateLimitStatus();
      if (rateLimit.limited) {
        applyLockout(rateLimit.resetAt);
        setIsLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        remember: rememberDevice ? "1" : "0",
        redirect: false,
      });

      if (result?.error) {
        const status = await fetchLoginRateLimitStatus();
        if (status.limited) {
          applyLockout(status.resetAt);
        } else {
          setRemaining(
            status.remaining >= LIMITER_DISABLED_REMAINING
              ? null
              : status.remaining
          );
          setError(result.error);
        }
        setIsLoading(false);
        return;
      }

      router.push("/bookings");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    rememberDevice,
    setRememberDevice,
    isLoading,
    error,
    remaining,
    lockedUntil,
    clearLockout,
    handleSubmit,
  };
}
