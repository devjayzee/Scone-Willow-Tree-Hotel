"use client";

import { useQuery } from "@tanstack/react-query";
import type { Staff } from "@/types/staff";
import { fetchStaffs } from "./staff-api";
import { staffKeys } from "./staff-keys";

export function useStaffs(
  initialData?: Staff[],
  initialDataUpdatedAt?: number
) {
  return useQuery({
    queryKey: staffKeys.list(),
    queryFn: fetchStaffs,
    initialData,
    initialDataUpdatedAt,
    staleTime: 1000 * 60 * 5,
  });
}
