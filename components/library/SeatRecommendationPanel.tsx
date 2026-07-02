"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Armchair } from "lucide-react";

import { LibraryLoginModal } from "@/components/library/LibraryLoginModal";
import { ReservationConfirmModal } from "@/components/library/ReservationConfirmModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isLibraryAuthError } from "@/hooks/useLibraryReservation";
import {
  getLibrarySeatRecommendations,
  prepareReservation,
  type LibraryReservationPrepareResponse,
  type LibrarySeatAttributes,
} from "@/lib/api/library";
import { ApiError, type LibraryFloorCode } from "@/lib/api/types";

const MAX_RECOMMENDATIONS = 5;

const ATTRIBUTE_LABELS: Array<[keyof LibrarySeatAttributes, string]> = [
  ["window", "창가"],
  ["outlet", "콘센트"],
  ["standing", "스탠딩"],
  ["edge", "가장자리"],
  ["quiet", "조용한 구역"],
  ["nearEntrance", "입구 근처"],
];

function attributeTags(attributes: LibrarySeatAttributes | null): string[] {
  if (!attributes) return [];
  return ATTRIBUTE_LABELS.filter(([key]) => attributes[key]).map(([, label]) => label);
}

interface SeatRecommendationPanelProps {
  floor: LibraryFloorCode;
  onReservationSuccess?: () => void;
}

export function SeatRecommendationPanel({
  floor,
  onReservationSuccess,
}: SeatRecommendationPanelProps) {
  const [pendingAction, setPendingAction] = useState<LibraryReservationPrepareResponse | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [preparingId, setPreparingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["library", "recommendations", floor],
    queryFn: () => getLibrarySeatRecommendations(floor),
    staleTime: 30_000,
    retry: (failureCount, err) => {
      if (isLibraryAuthError(err)) return false;
      return failureCount < 2;
    },
  });
  const recommendations = data?.recommendations;

  const needsAuth = error instanceof ApiError && error.code === "LIBRARY_SESSION_REQUIRED";

  async function handleReserve(externalSeatId: number) {
    setErrorMessage(null);
    setPreparingId(externalSeatId);
    try {
      const action = await prepareReservation({ type: "RESERVE", seatId: externalSeatId });
      setPendingAction(action);
    } catch (err) {
      if (err instanceof ApiError && err.code === "LIBRARY_SESSION_REQUIRED") {
        setShowLoginModal(true);
      } else {
        setErrorMessage("좌석 예약 준비 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } finally {
      setPreparingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mt-2 space-y-2" aria-label="추천 좌석 불러오는 중">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[52px] w-full rounded-control" />
        ))}
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="mt-2 flex flex-col items-start gap-2.5 rounded-control border border-hairline bg-muted/40 px-4 py-3.5">
        <p className="text-[13px] text-muted-foreground">
          추천 좌석은 도서관 로그인 후 이용할 수 있습니다.
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowLoginModal(true)}>
          로그인
        </Button>
        {showLoginModal ? <LibraryLoginModal onClose={() => setShowLoginModal(false)} /> : null}
      </div>
    );
  }

  if (!recommendations?.length) {
    return (
      <div className="mt-2 flex items-center gap-2.5 rounded-control bg-muted/50 px-4 py-3.5">
        <Armchair size={16} className="shrink-0 text-subtle" aria-hidden />
        <p className="text-[13px] text-muted-foreground">이 층에 이용 가능한 좌석이 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-2 space-y-2">
        {recommendations.slice(0, MAX_RECOMMENDATIONS).map((seat) => {
          const numericSeatId = Number(seat.externalSeatId);
          const tags = attributeTags(seat.attributes);
          return (
            <li
              key={seat.externalSeatId}
              className="flex items-center justify-between gap-3 rounded-control border border-hairline bg-surface px-3.5 py-2.5 shadow-e1"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="font-mono text-[13.5px] font-bold text-foreground">{seat.label}</span>
                <Badge variant="secondary" className="shrink-0">
                  {floor}F
                </Badge>
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-muted-foreground">{seat.roomName}</p>
                  {tags.length > 0 ? (
                    <p className="truncate text-[11px] text-subtle">{tags.join(" · ")}</p>
                  ) : null}
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0"
                disabled={preparingId === numericSeatId}
                onClick={() => void handleReserve(numericSeatId)}
              >
                {preparingId === numericSeatId ? "준비 중..." : "예약"}
              </Button>
            </li>
          );
        })}
      </ul>

      {errorMessage ? (
        <p className="mt-2 text-[13px] font-medium text-danger">{errorMessage}</p>
      ) : null}

      {pendingAction ? (
        <ReservationConfirmModal
          pendingAction={pendingAction}
          onClose={() => setPendingAction(null)}
          onSuccess={() => {
            setPendingAction(null);
            onReservationSuccess?.();
          }}
        />
      ) : null}

      {showLoginModal ? <LibraryLoginModal onClose={() => setShowLoginModal(false)} /> : null}
    </>
  );
}
