"use client";

import { useQuery } from "@tanstack/react-query";

import { getNotices } from "@/lib/api/notice";
import { FIVE_MINUTES_MS } from "@/lib/query";

export function useNotices(params?: { category?: string; page?: number }) {
  return useQuery({
    queryKey: ["notices", params],
    queryFn: () => getNotices(params),
    staleTime: FIVE_MINUTES_MS,
  });
}
