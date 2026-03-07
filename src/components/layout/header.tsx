"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const nameParts = session?.user?.name?.split(" ") || [];
  const firstName = nameParts[0] || "";
  const lastName = nameParts[nameParts.length - 1] || "";
  const initials = nameParts.length > 1
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : (firstName[0] || "U").toUpperCase();

  const roleLabel =
    session?.user?.role === "GENERAL_MANAGER"
      ? "General Manager"
      : session?.user?.role === "MANAGER"
        ? "Manager"
        : "Staff";

  return (
    <header className="h-16 border-b border-border bg-white px-4 flex items-center justify-between">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title area */}
      <div className="flex-1 lg:flex-none">
        <h2 className="text-sm lg:text-lg font-semibold text-navy truncate">
          <span className="lg:hidden">Hi, {session?.user?.firstName}</span>
          <span className="hidden lg:inline">Welcome back, {session?.user?.firstName}</span>
        </h2>
      </div>

      {/* User menu */}
      <div className="flex items-center gap-4">
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 hover:bg-cream"
              >
                <Avatar className="h-8 w-8 bg-navy text-cream">
                  <AvatarFallback className="bg-navy text-cream text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-navy">
                    {session?.user?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 bg-navy text-cream">
              <AvatarFallback className="bg-navy text-cream text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-navy">
                {session?.user?.name}
              </p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
