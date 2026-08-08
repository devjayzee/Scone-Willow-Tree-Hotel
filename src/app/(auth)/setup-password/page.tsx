"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useInviteToken } from "@/hooks/auth";
import { useSetupPasswordForm } from "@/hooks/use-setup-password-form";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

const inputClasses =
  "h-[46px] rounded-lg border-input bg-surface-raised px-4 text-[15px] shadow-none md:text-[15px] focus-visible:border-gold focus-visible:ring-ring/25";

function InvalidInviteScreen() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-destructive bg-destructive/15">
        <X className="h-[26px] w-[26px] text-destructive" />
      </div>
      <h1 className="font-display text-4xl leading-[1.1] font-semibold text-foreground">
        This link has expired
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
        This invite link is invalid or has expired. Ask a manager to send you
        a new invitation.
      </p>
      <Button
        asChild
        className="mt-8 h-12 w-full rounded-lg text-[15px] font-semibold transition-[filter] hover:brightness-[1.12]"
      >
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}

function InviteSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="h-4 w-40 animate-pulse rounded bg-muted-foreground/20" />
      <div className="h-10 w-4/5 animate-pulse rounded bg-muted-foreground/20" />
      <div className="h-24 w-full animate-pulse rounded-lg bg-muted-foreground/20" />
    </div>
  );
}

function SetupPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invite = useInviteToken(token);
  const {
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
  } = useSetupPasswordForm(token ?? "");

  if (!token || invalidToken || invite.isError) {
    return <InvalidInviteScreen />;
  }

  if (invite.isPending) {
    return <InviteSkeleton />;
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-success bg-success/15">
          <Check className="h-[26px] w-[26px] text-success" />
        </div>
        <h1 className="font-display text-4xl leading-[1.1] font-semibold text-foreground">
          You&apos;re all set, {invite.data.firstName}
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
          Your account is ready. Sign in to start managing bookings.
        </p>
        <Button
          asChild
          className="mt-8 h-12 w-full rounded-lg text-[15px] font-semibold transition-[filter] hover:brightness-[1.12]"
        >
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3.5 text-xs font-semibold tracking-[0.2em] text-gold">
        WELCOME TO THE TEAM
      </p>
      <h1 className="font-display text-[40px] leading-[1.1] font-semibold text-foreground">
        Create your password
      </h1>
      <p className="mt-2.5 mb-8 text-[15px] leading-normal text-muted-foreground">
        You&apos;ve been invited as{" "}
        <strong className="font-semibold text-foreground">
          {ROLE_LABELS[invite.data.role]}
        </strong>
        . Set a password to finish creating your account.
      </p>

      <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-border bg-surface-raised p-[12px_16px]">
        <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
        <span className="text-sm text-foreground">{invite.data.email}</span>
        <span className="ml-auto text-[11px] tracking-[0.08em] text-muted-foreground">
          VERIFIED
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-[12px_14px] text-sm leading-[1.45] text-destructive dark:bg-destructive/22"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-[13px]">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter a password"
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm" className="text-[13px]">
            Confirm password
          </Label>
          <Input
            id="confirm"
            name="confirm"
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter the password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-[14px_16px]">
          <PasswordStrengthIndicator password={password} variant="list" />
          <div className="flex items-center gap-2.5 text-[13px]">
            <span
              aria-hidden
              className={cn(
                "h-[7px] w-[7px] rounded-full",
                passwordsMatch
                  ? "bg-success"
                  : "bg-[#c9baa0] dark:bg-[#4a5d78]"
              )}
            />
            <span
              className={cn(
                passwordsMatch ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Passwords match
            </span>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="h-12 w-full gap-2.5 rounded-lg text-[15px] font-semibold transition-[filter] hover:brightness-[1.12] disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Creating…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetupPasswordContent />
    </Suspense>
  );
}
