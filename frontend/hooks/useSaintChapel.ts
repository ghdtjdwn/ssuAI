"use client";

import { useQuery } from "@tanstack/react-query";

import { getSaintChapel } from "@/lib/api/saint";
import { ONE_HOUR_MS } from "@/lib/query";

export function useSaintChapel(accessToken: string | null) {
  return useQuery({
    queryKey: ["saint", "chapel", accessToken],
    queryFn: () => getSaintChapel(accessToken!),
    enabled: !!accessToken,
    staleTime: ONE_HOUR_MS,
  });
}
