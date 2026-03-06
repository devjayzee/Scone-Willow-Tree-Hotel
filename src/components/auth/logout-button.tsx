"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="border-navy text-navy hover:bg-navy hover:text-cream"
    >
      <LogOut className="h-4 w-4 mr-2" />
      Sign Out
    </Button>
  );
}
