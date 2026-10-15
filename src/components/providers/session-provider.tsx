"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { SESSION_POLL_INTERVAL_SECONDS } from "@/lib/constants/auth";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider
      // Re-fetch session periodically to detect invalidation. The interval
      // and the endpoint's limit share a budget; see the note on
      // SESSION_POLL_INTERVAL_SECONDS in constants/auth.ts.
      refetchInterval={SESSION_POLL_INTERVAL_SECONDS}
      // Re-fetch session when window regains focus
      refetchOnWindowFocus={true}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
