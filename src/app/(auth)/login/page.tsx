"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useLoginForm } from "@/hooks/use-login-form";

const inputClasses =
  "h-[46px] rounded-lg border-input bg-surface-raised px-4 text-[15px] shadow-none md:text-[15px] focus-visible:border-gold focus-visible:ring-ring/25";

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    error,
    remaining,
    lockedUntil,
    clearLockout,
    handleSubmit,
  } = useLoginForm();

  useEffect(() => {
    if (lockedUntil === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearLockout();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil, clearLockout]);

  if (lockedUntil !== null) {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="mb-3.5 text-xs font-semibold tracking-[0.2em] text-destructive">
          ACCOUNT PROTECTION
        </p>
        <h1 className="font-display text-[40px] leading-[1.1] font-semibold text-foreground">
          Too many attempts
        </h1>
        <p className="mt-2.5 mb-8 text-[15px] leading-normal text-muted-foreground">
          Sign-in has been temporarily disabled from this device. You can try
          again when the timer runs out.
        </p>
        <p
          className="text-[56px] font-semibold tracking-[0.04em] text-foreground tabular-nums"
          aria-live="polite"
        >
          {formatCountdown(secondsLeft)}
          <span className="sr-only">
            {Math.ceil(secondsLeft / 60)} minutes remaining
          </span>
        </p>
        <p className="text-[13px] text-muted-foreground">minutes remaining</p>
        <div className="mt-8 w-full rounded-lg bg-destructive/10 p-[14px_16px] text-left text-sm text-destructive">
          If this wasn&apos;t you, contact the duty manager to review recent
          sign-in activity.
        </div>
        <Link
          href="/forgot-password"
          className="mt-6 text-sm text-gold-dark hover:underline dark:text-gold-light"
        >
          Reset password instead
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3.5 text-xs font-semibold tracking-[0.2em] text-gold">
        BOOKING MANAGEMENT
      </p>
      <h1 className="font-display text-[40px] leading-[1.1] font-semibold text-foreground">
        Welcome back
      </h1>
      <p className="mt-2.5 mb-8 text-[15px] leading-normal text-muted-foreground">
        Sign in to manage reservations, rooms and staff.
      </p>

      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-[12px_14px] text-sm leading-[1.45] text-destructive dark:bg-destructive/22"
          >
            {remaining !== null ? (
              <>
                Invalid email or password.{" "}
                <strong className="font-semibold">{remaining}</strong> attempts
                remaining before a temporary lockout.
              </>
            ) : (
              error
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-[13px]">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@sconewillowtree.com.au"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password" className="text-[13px]">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-[13px] text-gold-dark hover:underline dark:text-gold-light"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClasses} pr-[46px]`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-gold"
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 select-none">
          {/* TODO: wire to per-login session maxAge via a NextAuth callback — UI-only for now */}
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="h-4 w-4 accent-gold"
          />
          <span className="text-sm text-muted-foreground">
            Remember this device
          </span>
        </label>

        <Button
          type="submit"
          disabled={isLoading}
          className="h-12 w-full gap-2.5 rounded-lg text-[15px] font-semibold transition-[filter] hover:brightness-[1.12] disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </div>
  );
}
