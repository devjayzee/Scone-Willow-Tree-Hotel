"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchInviteToken } from "@/hooks/auth/auth-api";
import { authKeys } from "@/hooks/auth/auth-keys";

export function useInviteToken(token: string | null) {
  return useQuery({
    queryKey: authKeys.invite(token ?? ""),
    queryFn: () => fetchInviteToken(token as string),
    enabled: Boolean(token),
    // One bad token must not get retried into the rate limit
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}
