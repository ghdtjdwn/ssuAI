"use client";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useLibrarySeatSse } from "@/hooks/useLibrarySeatSse";
import { useLibrarySeatStatus } from "@/hooks/useLibrarySeatStatus";
import type { LibraryFloorCode, LibrarySeatZone } from "@/lib/api/types";

export interface ZoneWithFloor extends LibrarySeatZone {
  floor: LibraryFloorCode;
  floorLabel: string;
}

/**
 * Aggregates seat status for every library floor (2/5/6) into a flat zone
 * list so home surfaces (hero summary, priority card, seats widget) can
 * reason about "the most available space right now" without picking a floor.
 * React Query dedupes the underlying ["library","seats",floor] queries with
 * the library screen; SSE pushes keep the numbers live.
 */
export function useLibraryZones() {
  const f2 = useLibrarySeatStatus(2);
  const f5 = useLibrarySeatStatus(5);
  const f6 = useLibrarySeatStatus(6);

  // useLibrarySeatSse keeps the latest callback in a ref, so inline closures are fine.
  useLibrarySeatSse(2, () => void f2.refetch());
  useLibrarySeatSse(5, () => void f5.refetch());
  useLibrarySeatSse(6, () => void f6.refetch());

  const queries = [f2, f5, f6];

  const zones: ZoneWithFloor[] = queries.flatMap((q) =>
    q.data
      ? q.data.zones.map((zone) => ({
          ...zone,
          floor: q.data!.floor,
          floorLabel: q.data!.floorLabel,
        }))
      : [],
  );

  const needsAuth = queries.some(
    (q) => getErrorStateDetails(q.error)?.code === "LIBRARY_SESSION_REQUIRED",
  );
  const isLoading = zones.length === 0 && !needsAuth && queries.some((q) => q.isLoading);
  const error = needsAuth ? null : (queries.map((q) => q.error).find(Boolean) ?? null);

  const bestZone = zones.reduce<ZoneWithFloor | null>(
    (best, zone) => (!best || zone.available > best.available ? zone : best),
    null,
  );

  const refetchAll = () => {
    void f2.refetch();
    void f5.refetch();
    void f6.refetch();
  };

  return { zones, bestZone, isLoading, needsAuth, error, refetchAll };
}
