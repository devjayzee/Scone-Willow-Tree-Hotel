"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

const DARK_ENABLED_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/setup-password",
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const darkEnabled = DARK_ENABLED_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Dashboard has no dark design yet — force light outside the auth pages.
      forcedTheme={darkEnabled ? undefined : "light"}
    >
      {children}
    </NextThemesProvider>
  );
}
