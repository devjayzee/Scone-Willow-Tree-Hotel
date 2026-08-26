"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { SESSION_POLL_INTERVAL_SECONDS } from "@/lib/constants/auth";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider
      // Re-fetch session periodically to detect invalidation. Coupled to
      // getSessionEndpointRateLimiter's bucket size — see that constant's docblock.
      refetchInterval={SESSION_POLL_INTERVAL_SECONDS}
      // Re-fetch session when window regains focus
      refetchOnWindowFocus={true}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
