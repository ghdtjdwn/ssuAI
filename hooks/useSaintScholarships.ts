"use client";

import { useQuery } from "@tanstack/react-query";

import { getSaintScholarships } from "@/lib/api/saint";
import { ONE_HOUR_MS } from "@/lib/query";

export function useSaintScholarships(accessToken: string | null) {
  return useQuery({
    queryKey: ["saint", "scholarships"],
    queryFn: () => getSaintScholarships(accessToken!),
    enabled: !!accessToken,
    staleTime: ONE_HOUR_MS,
  });
}
