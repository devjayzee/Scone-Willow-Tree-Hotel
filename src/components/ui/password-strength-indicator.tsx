"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { checkPasswordStrength } from "@/lib/validations/password";
import { cn } from "@/lib/utils";

function RequirementCheck({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <X className="h-3 w-3 text-gray-400" />
      )}
      <span className={cn(met ? "text-green-700" : "text-gray-500")}>
        {label}
      </span>
    </div>
  );
}

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { checks, strength } = useMemo(
    () => checkPasswordStrength(password),
    [password]
  );

  if (!password) return null;

  const strengthColors = {
    weak: "bg-red-500",
    fair: "bg-orange-500",
    good: "bg-yellow-500",
    strong: "bg-green-500",
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
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
            strength === "weak" && "text-red-600",
            strength === "fair" && "text-orange-600",
            strength === "good" && "text-yellow-600",
            strength === "strong" && "text-green-600"
          )}
        >
          {strength}
        </span>
      </div>

      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <RequirementCheck met={checks.minLength} label="8+ characters" />
        <RequirementCheck met={checks.hasUppercase} label="Uppercase (A-Z)" />
        <RequirementCheck met={checks.hasLowercase} label="Lowercase (a-z)" />
        <RequirementCheck met={checks.hasNumber} label="Number (0-9)" />
        <RequirementCheck met={checks.hasSpecial} label="Special (!@#$%)" />
      </div>
    </div>
  );
}
