"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";
import { useForgotPasswordForm } from "@/hooks/use-forgot-password-form";
import { authInputClasses } from "@/components/auth/auth-input-classes";
import { RESET_TOKEN_TTL_MINUTES } from "@/lib/constants/auth";

export default function ForgotPasswordPage() {
  const { email, setEmail, isLoading, sent, error, handleSubmit } =
    useForgotPasswordForm();

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-gold bg-gold/15">
          <Mail className="h-[26px] w-[26px] text-gold" />
        </div>
        <h1 className="font-display text-4xl leading-[1.1] font-semibold text-foreground">
          Check your email
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
          If an account exists for{" "}
          <strong className="font-semibold text-foreground">{email}</strong>, a
          reset link is on its way. It expires in {RESET_TOKEN_TTL_MINUTES}{" "}
          minutes.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block text-sm text-gold-dark hover:underline dark:text-gold-light"
        >
          &larr; Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3.5 text-xs font-semibold tracking-[0.2em] text-gold">
        ACCOUNT RECOVERY
      </p>
      <h1 className="font-display text-[40px] leading-[1.1] font-semibold text-foreground">
        Forgot your password?
      </h1>
      <p className="mt-2.5 mb-8 text-[15px] leading-normal text-muted-foreground">
        Enter your work email and we&apos;ll send you a link to reset it.
      </p>

      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-[12px_14px] text-sm leading-[1.45] text-destructive dark:bg-destructive/22"
          >
            {error}
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
            className={authInputClasses}
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="h-12 w-full gap-2.5 rounded-lg text-[15px] font-semibold transition-[filter] hover:brightness-[1.12] disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>

        <Link
          href="/login"
          className="text-center text-sm text-gold-dark hover:underline dark:text-gold-light"
        >
          &larr; Back to sign in
        </Link>
      </form>
    </div>
  );
}
