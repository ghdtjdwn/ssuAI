"use client";

import { useQuery } from "@tanstack/react-query";

import { getSaintGraduation } from "@/lib/api/saint";
import { ONE_HOUR_MS } from "@/lib/query";

export function useSaintGraduation(accessToken: string | null) {
  return useQuery({
    queryKey: ["saint", "graduation"],
    queryFn: () => getSaintGraduation(accessToken!),
    enabled: !!accessToken,
    staleTime: ONE_HOUR_MS,
  });
}
