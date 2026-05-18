"use client";

import { useQuery } from "@tanstack/react-query";

import { getSaintSchedule } from "@/lib/api/saint";
import { ONE_HOUR_MS } from "@/lib/query";

export function useSaintSchedule(accessToken: string | null) {
  return useQuery({
    queryKey: ["saint", "schedule", accessToken],
    queryFn: () => getSaintSchedule(accessToken!),
    enabled: !!accessToken,
    staleTime: ONE_HOUR_MS,
  });
}
