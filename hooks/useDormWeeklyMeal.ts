"use client";

import { useQuery } from "@tanstack/react-query";

import { getDormThisWeekMeal } from "@/lib/api/dorm";
import { FIVE_MINUTES_MS } from "@/lib/query";

export function useDormWeeklyMeal() {
  return useQuery({
    queryKey: ["dorm", "weekly"],
    queryFn: getDormThisWeekMeal,
    staleTime: FIVE_MINUTES_MS,
  });
}
