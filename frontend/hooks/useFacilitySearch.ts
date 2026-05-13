"use client";

import { useQuery } from "@tanstack/react-query";

import { searchFacilities } from "@/lib/api/facility";
import { FIVE_MINUTES_MS } from "@/lib/query";

export function useFacilitySearch(normalizedQuery: string) {
  return useQuery({
    queryKey: ["facility", "search", normalizedQuery],
    queryFn: () => searchFacilities(normalizedQuery),
    enabled: normalizedQuery.length > 0,
    staleTime: FIVE_MINUTES_MS,
  });
}
