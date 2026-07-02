"use client";

import { BookOpen, ChevronDown, ChevronUp, LogIn } from "lucide-react";
import { useCallback, useState } from "react";

import { LibraryLoginModal } from "@/components/library/LibraryLoginModal";
import { SeatRecommendationPanel } from "@/components/library/SeatRecommendationPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrarySeatSse } from "@/hooks/useLibrarySeatSse";
import { useLibrarySeatStatus } from "@/hooks/useLibrarySeatStatus";
import type { LibraryFloorCode, LibrarySeatZone } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const FLOOR_OPTIONS: ReadonlyArray<{ code: LibraryFloorCode; label: string }> = [
  { code: 2, label: "2층" },
  { code: 5, label: "5층" },
  { code: 6, label: "6층" },
];

const DEFAULT_FLOOR: LibraryFloorCode = 2;
const COLLAPSED_SEAT_COUNT = 60;

const SEAT_STATUS_LABEL = {
  available: "가능",
  occupied: "사용중",
  outOfService: "비활성",
} as const;


function LibrarySeatSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

function SeatDetails({ zone }: { zone: LibrarySeatZone }) {
  const [expanded, setExpanded] = useState(false);
  const seats = zone.seats ?? [];

  if (seats.length === 0) {
    return zone.seatIds.length > 0 ? (
      <p className="mt-1 truncate text-xs text-muted-foreground">
        빈 자리: {zone.seatIds.join(", ")}
      </p>
    ) : null;
  }

  const hasMoreSeats = seats.length > COLLAPSED_SEAT_COUNT;
  const visibleSeats = expanded ? seats : seats.slice(0, COLLAPSED_SEAT_COUNT);

  return (
    <>
      <div
        className="mt-2 flex flex-wrap gap-1"
        aria-label={`${zone.label} 개별 좌석 현황`}
      >
        {visibleSeats.map((seat) => (
          <span
            key={seat.id}
            title={`${seat.label} (${SEAT_STATUS_LABEL[seat.status]})`}
            className={cn(
              "inline-flex h-6 min-w-10 items-center justify-center rounded-[6px] px-1 font-mono text-[10px] font-bold",
              seat.status === "available" && "bg-success-bg text-success",
              seat.status === "occupied" && "bg-danger-bg text-danger",
              seat.status === "outOfService" &&
                "bg-muted text-muted-foreground opacity-50",
            )}
          >
            {seat.label}
          </span>
        ))}
      </div>
      {hasMoreSeats ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-xs"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "접기" : `모두 보기 (${seats.length}석)`}
        </Button>
      ) : null}
    </>
  );
}

function SeatLegend() {
  return (
    <div className="flex gap-3 text-xs text-muted-foreground" aria-label="좌석 상태 범례">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-success-bg ring-1 ring-inset ring-success/40" />
        가능
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-danger-bg ring-1 ring-inset ring-danger/40" />
        사용중
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-muted" />
        비활성
      </span>
    </div>
  );
}

export function LibrarySeatCard() {
  const [floor, setFloor] = useState<LibraryFloorCode>(DEFAULT_FLOOR);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const { data, error, isLoading, isFetching, refetch } = useLibrarySeatStatus(floor);

  const handleSeatUpdate = useCallback(() => {
    void refetch();
  }, [refetch]);

  useLibrarySeatSse(floor, handleSeatUpdate);

  const errorState = getErrorStateDetails(error);
  const needsAuth = errorState?.code === "LIBRARY_SESSION_REQUIRED";
  const usagePercent =
    data && data.totalSeats > 0
      ? Math.round(((data.totalSeats - data.availableSeats) / data.totalSeats) * 100)
      : 0;


  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>도서관 좌석</CardTitle>
        <CardDescription>중앙도서관 층별 현재 잔여 좌석 (30초 자동 갱신)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="도서관 층 선택">
          {FLOOR_OPTIONS.map((option) => {
            const isActive = option.code === floor;
            return (
              <Button
                key={option.code}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFloor(option.code)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>

        <div className="mb-4">
          <button
            type="button"
            className="press inline-flex cursor-pointer items-center gap-1 text-[13px] font-bold text-primary"
            onClick={() => setShowRecommendations((prev) => !prev)}
          >
            {showRecommendations ? (
              <ChevronUp size={14} aria-hidden />
            ) : (
              <ChevronDown size={14} aria-hidden />
            )}
            {showRecommendations ? "추천 좌석 예약 닫기" : "추천 좌석 예약"}
          </button>
          {showRecommendations ? (
            <SeatRecommendationPanel
              floor={floor}
              onReservationSuccess={() => setShowRecommendations(false)}
            />
          ) : null}
        </div>

        {isLoading ? <LibrarySeatSkeleton /> : null}

        {needsAuth ? (
          <div className="flex flex-col items-start gap-3 rounded-control border border-dashed border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              실시간 좌석 현황은 도서관 로그인이 필요합니다.
            </p>
            <Button size="sm" onClick={() => setShowLoginModal(true)}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              도서관 연동
            </Button>
          </div>
        ) : errorState ? (
          <ErrorState
            code={errorState.code}
            message={errorState.message}
            traceId={errorState.traceId}
            onRetry={() => void refetch()}
          />
        ) : null}

        {showLoginModal ? (
          <LibraryLoginModal onClose={() => setShowLoginModal(false)} />
        ) : null}

        {data && !errorState ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-muted-foreground">{data.floorLabel}</p>
                <p className="font-mono text-sm tabular-nums text-muted-foreground">
                  <span className="font-bold text-foreground">{data.availableSeats}</span>
                  <span> / {data.totalSeats}석 이용 가능</span>
                </p>
              </div>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-muted"
                role="progressbar"
                aria-valuenow={usagePercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${data.floorLabel} 좌석 사용률 ${usagePercent}%`}
              >
                <div
                  className={cn(
                    "h-full rounded-pill transition-all",
                    usagePercent >= 90
                      ? "bg-danger"
                      : usagePercent >= 70
                        ? "bg-warning"
                        : "bg-success",
                  )}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">예약 {data.reservedSeats}</Badge>
                {data.outOfServiceSeats > 0 ? (
                  <Badge variant="outline">사용 불가 {data.outOfServiceSeats}</Badge>
                ) : null}
                {isFetching && !isLoading ? (
                  <span className="text-subtle">갱신 중…</span>
                ) : null}
              </div>
            </div>

            {data.zones.length > 0 ? (
              <ul className="space-y-2" aria-label="구역별 좌석 현황">
                {data.zones.map((zone) => (
                  <li
                    key={zone.label}
                    className="rounded-control border border-hairline bg-surface p-3 shadow-e1"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-bold text-foreground">{zone.label}</p>
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        <span className="font-bold text-foreground">{zone.available}</span>
                        <span> / {zone.total}석</span>
                      </p>
                    </div>
                    <SeatDetails zone={zone} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
                title="구역 정보가 없습니다"
                description="이 층은 구역별 분류가 제공되지 않습니다."
              />
            )}

            {data.zones.some((zone) => (zone.seats?.length ?? 0) > 0) ? (
              <SeatLegend />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
