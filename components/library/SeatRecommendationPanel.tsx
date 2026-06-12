"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { LibraryLoginModal } from "@/components/library/LibraryLoginModal";
import { ReservationConfirmModal } from "@/components/library/ReservationConfirmModal";
import { Button } from "@/components/ui/button";
import {
  getLibrarySeatRecommendations,
  prepareReservation,
  type LibraryReservationPrepareResponse,
} from "@/lib/api/library";
import { ApiError, type LibraryFloorCode } from "@/lib/api/types";

interface SeatRecommendationPanelProps {
  floor: LibraryFloorCode;
}

export function SeatRecommendationPanel({ floor }: SeatRecommendationPanelProps) {
  const [pendingAction, setPendingAction] = useState<LibraryReservationPrepareResponse | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [preparingId, setPreparingId] = useState<number | null>(null);

  const {
    data: recommendations,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["library", "recommendations", floor],
    queryFn: () => getLibrarySeatRecommendations(floor),
    staleTime: 30_000,
    retry: (failureCount, err) => {
      if (
        err instanceof ApiError &&
        (err.httpStatus === 401 || err.code === "LIBRARY_SESSION_REQUIRED")
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const needsAuth = error instanceof ApiError && error.code === "LIBRARY_SESSION_REQUIRED";

  async function handleReserve(externalSeatId: number) {
    setPreparingId(externalSeatId);
    try {
      const action = await prepareReservation({ type: "RESERVE", seatId: externalSeatId });
      setPendingAction(action);
    } catch (err) {
      if (err instanceof ApiError && err.code === "LIBRARY_SESSION_REQUIRED") {
        setShowLoginModal(true);
      }
    } finally {
      setPreparingId(null);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">추천 좌석을 불러오는 중...</p>;
  }

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
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
    return <p className="text-sm text-muted-foreground">이 층에 이용 가능한 좌석이 없습니다.</p>;
  }

  return (
    <>
      <ul className="mt-2 space-y-2">
        {recommendations.slice(0, 5).map((seat) => (
          <li
            key={seat.externalSeatId}
            className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{seat.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{seat.roomName}</span>
              {seat.attributes.length > 0 ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({seat.attributes.join(", ")})
                </span>
              ) : null}
            </div>
            <Button
              size="sm"
              disabled={preparingId === seat.externalSeatId}
              onClick={() => void handleReserve(seat.externalSeatId)}
            >
              {preparingId === seat.externalSeatId ? "준비 중..." : "예약"}
            </Button>
          </li>
        ))}
      </ul>

      {pendingAction ? (
        <ReservationConfirmModal
          pendingAction={pendingAction}
          onClose={() => setPendingAction(null)}
          onSuccess={() => setPendingAction(null)}
        />
      ) : null}

      {showLoginModal ? <LibraryLoginModal onClose={() => setShowLoginModal(false)} /> : null}
    </>
  );
}
