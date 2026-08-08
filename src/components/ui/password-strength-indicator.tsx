"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { checkPasswordStrength } from "@/lib/validations/password";
import { cn } from "@/lib/utils";

const REQUIREMENTS = [
  { key: "minLength", label: "8+ characters" },
  { key: "hasUppercase", label: "Uppercase (A-Z)" },
  { key: "hasLowercase", label: "Lowercase (a-z)" },
  { key: "hasNumber", label: "Number (0-9)" },
  { key: "hasSpecial", label: "Special (!@#$%)" },
] as const;

function RequirementCheck({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <X className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={cn(met ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

function RequirementRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span
        aria-hidden
        className={cn(
          "h-[7px] w-[7px] rounded-full",
          met ? "bg-success" : "bg-[#c9baa0] dark:bg-[#4a5d78]"
        )}
      />
      <span className={cn(met ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

export function PasswordStrengthIndicator({
  password,
  variant = "grid",
}: {
  password: string;
  variant?: "grid" | "list";
}) {
  const { checks, strength } = useMemo(
    () => checkPasswordStrength(password),
    [password]
  );

  // List variant renders unmet dots for an empty password (live checklist
  // is visible before typing); the grid variant keeps its hide-when-empty
  // behaviour for existing call sites.
  if (!password && variant === "grid") return null;

  if (variant === "list") {
    return (
      <div className="flex flex-col gap-2">
        {REQUIREMENTS.map(({ key, label }) => (
          <RequirementRow key={key} met={checks[key]} label={label} />
        ))}
      </div>
    );
  }

  const strengthColors = {
    weak: "bg-destructive",
    fair: "bg-orange-500",
    good: "bg-gold",
    strong: "bg-success",
  };

  const strengthWidths = {
    weak: "w-1/4",
    fair: "w-2/4",
    good: "w-3/4",
    strong: "w-full",
  };

  return (
    <div className="space-y-2 mt-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300",
              strengthColors[strength],
              strengthWidths[strength]
            )}
          />
        </div>
        <span
          className={cn(
            "text-xs font-medium capitalize",
            strength === "weak" && "text-destructive",
            strength === "fair" && "text-orange-600",
            strength === "good" && "text-gold-dark",
            strength === "strong" && "text-success"
          )}
        >
          {strength}
        </span>
      </div>

      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {REQUIREMENTS.map(({ key, label }) => (
          <RequirementCheck key={key} met={checks[key]} label={label} />
        ))}
      </div>
    </div>
  );
}
