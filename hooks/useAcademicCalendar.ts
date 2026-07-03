"use client";

import { useQuery } from "@tanstack/react-query";

import { getAcademicCalendar } from "@/lib/api/calendar";

/**
 * Public academic calendar. Changes rarely (published once per year), so it is
 * cached aggressively. `year` omitted → the backend uses the current KST year.
 */
export function useAcademicCalendar(year?: number) {
  return useQuery({
    queryKey: ["academic-calendar", year ?? "current"],
    queryFn: () => getAcademicCalendar(year),
    staleTime: 12 * 60 * 60 * 1000,
  });
}
