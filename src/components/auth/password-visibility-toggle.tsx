"use client";

import { Eye, EyeOff } from "lucide-react";

interface PasswordVisibilityToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export function PasswordVisibilityToggle({
  visible,
  onToggle,
}: PasswordVisibilityToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-gold"
    >
      {visible ? (
        <EyeOff className="h-[18px] w-[18px]" />
      ) : (
        <Eye className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
