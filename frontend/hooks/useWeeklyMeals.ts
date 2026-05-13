"use client";

import { useQuery } from "@tanstack/react-query";

import { getWeeklyMeals } from "@/lib/api/meal";
import { FIVE_MINUTES_MS } from "@/lib/query";

export function useWeeklyMeals(startDate?: string) {
  return useQuery({
    queryKey: ["meal", "weekly", startDate ?? "current-week"],
    queryFn: () => getWeeklyMeals(startDate),
    staleTime: FIVE_MINUTES_MS,
  });
}
