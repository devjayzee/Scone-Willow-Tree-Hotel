"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      // Light-only for now — the dashboard has no dark design and the user
      // chose to hold dark auth pages back until a real toggle ships with
      // it. The .dark token values stay in globals.css; drop forcedTheme
      // (and add a toggle) to activate them.
      forcedTheme="light"
    >
      {children}
    </NextThemesProvider>
  );
}
