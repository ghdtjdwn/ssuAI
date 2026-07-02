"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useLibraryAuth } from "@/contexts/LibraryAuthContext";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { ApiError } from "@/lib/api/types";

export interface ConnectionsState {
  saint: boolean;
  lms: boolean;
  library: boolean;
  count: number;
}

/**
 * u-SAINT · LMS · 도서관 connection states for the shell badge.
 * SAINT and LIBRARY come from their auth contexts; LMS is inferred the same
 * way LibraryAuthContext infers library state — from lms query outcomes —
 * because the LMS provider session lives server-side behind the same JWT.
 */
export function useConnections(): ConnectionsState {
  const { isAuthenticated } = useSaintAuth();
  const { isConnected: library } = useLibraryAuth();
  const queryClient = useQueryClient();
  const [lmsOk, setLmsOk] = useState(false);

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      const queryKey = event.query.queryKey as unknown[];
      if (queryKey[0] !== "lms") return;

      const { status, error, data } = event.query.state;
      if (status === "success" && data) {
        setLmsOk(true);
      } else if (status === "error" && error instanceof ApiError) {
        setLmsOk(false);
      }
    });
  }, [queryClient]);

  const lms = isAuthenticated && lmsOk;
  const count = (isAuthenticated ? 1 : 0) + (lms ? 1 : 0) + (library ? 1 : 0);
  return { saint: isAuthenticated, lms, library, count };
}
