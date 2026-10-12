"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <NextThemesProvider
      nonce={nonce}
      attribute="class"
      defaultTheme="light"
      // Light-only for now — the dashboard has no dark design. The .dark
      // token values stay in globals.css; drop forcedTheme (and add a
      // toggle) to activate them.
      forcedTheme="light"
    >
      {children}
    </NextThemesProvider>
  );
}
