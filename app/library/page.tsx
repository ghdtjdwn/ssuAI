"use client";

import { ArrowLeft, Armchair, BookOpen, Hourglass, LayoutGrid } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { LibraryBookSearchCard } from "@/components/library/LibraryBookSearchCard";
import { LibraryLoansCard } from "@/components/library/LibraryLoansCard";
import { LibraryLoginModal } from "@/components/library/LibraryLoginModal";
import { SeatRecommendationPanel } from "@/components/library/SeatRecommendationPanel";
import { WaitStatusCard } from "@/components/library/WaitStatusCard";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DonutGauge, ProgressBar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useLibraryAuth } from "@/contexts/LibraryAuthContext";
import { isLibraryAuthError, useRegisterWait } from "@/hooks/useLibraryReservation";
import { useLibrarySeatSse } from "@/hooks/useLibrarySeatSse";
import { useLibrarySeatStatus } from "@/hooks/useLibrarySeatStatus";
import type { LibraryFloorCode, LibrarySeatItem, LibrarySeatZone } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type LibView = "overview" | "space" | "all";

interface SpaceEntry {
  key: string;
  floor: LibraryFloorCode;
  floorLabel: string;
  zone: LibrarySeatZone;
}

/** "오픈열람실(2F)" → { name: "오픈열람실", floorTag: "2F" } */
function splitZoneLabel(label: string, floorLabel: string) {
  const match = label.match(/^(.*?)\s*\((\d+\s*F)\)\s*$/i);
  if (match) return { name: match[1], floorTag: match[2].replace(/\s/g, "") };
  return { name: label, floorTag: floorLabel };
}

function availabilityBadge(available: number, total: number) {
  if (total > 0 && available <= 0) return { label: "만석", variant: "destructive" as const };
  if (total > 0 && available / total >= 0.4) return { label: "여유", variant: "success" as const };
  return { label: "혼잡", variant: "warning" as const };
}

function progressTone(available: number, total: number) {
  const ratio = total > 0 ? available / total : 0;
  return ratio >= 0.4 ? ("success" as const) : ratio >= 0.15 ? ("warning" as const) : ("danger" as const);
}

const SEAT_STATUS_LABEL: Record<LibrarySeatItem["status"], string> = {
  available: "가능",
  occupied: "사용중",
  outOfService: "비활성",
};

function SeatDotGrid({
  zone,
  columns,
}: {
  zone: LibrarySeatZone;
  columns: 10 | 20;
}) {
  return (
    <div
      role="img"
      aria-label={`${zone.label} 좌석 현황: 전체 ${zone.total}석 중 ${zone.available}석 이용 가능`}
      className={cn(
        "grid",
        columns === 10 ? "grid-cols-10 gap-1.5" : "grid-cols-[repeat(20,minmax(0,1fr))] gap-1",
      )}
    >
      {zone.seats.map((seat) => (
        <span
          key={seat.id}
          aria-hidden="true"
          title={`${seat.label} (${SEAT_STATUS_LABEL[seat.status]})`}
          className={cn(
            "aspect-square rounded-[5px]",
            seat.status === "available"
              ? "bg-success"
              : seat.status === "occupied"
                ? "bg-border"
                : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function SeatDotLegend() {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-muted-foreground" aria-label="좌석 상태 범례">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-success" />
        빈자리
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-border" />
        사용중
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-muted" />
        비활성
      </span>
    </div>
  );
}

function ConnectGateCard({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-muted/40 px-5 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-primary-soft text-primary-soft-foreground">
        <BookOpen size={20} aria-hidden />
      </span>
      <p className="text-[13.5px] font-medium leading-relaxed text-muted-foreground">
        도서관 계정을 연결하면 좌석 예약과
        <br className="sm:hidden" /> 대출 현황을 볼 수 있어요
      </p>
      <Button size="sm" onClick={onConnect}>
        연결
      </Button>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="flex flex-col items-center gap-3 rounded-card border border-hairline bg-surface p-4"
        >
          <Skeleton className="h-[88px] w-[88px] rounded-pill" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-12 rounded-pill" />
        </div>
      ))}
    </div>
  );
}

export default function LibraryPage() {
  const [libView, setLibView] = useState<LibView>("overview");
  const [libSpace, setLibSpace] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { isConnected } = useLibraryAuth();
  const { toast } = useToast();
  const registerWaitMutation = useRegisterWait();
  const recommendationRef = useRef<HTMLDivElement>(null);

  const floor2 = useLibrarySeatStatus(2);
  const floor5 = useLibrarySeatStatus(5);
  const floor6 = useLibrarySeatStatus(6);
  const queries = [floor2, floor5, floor6] as const;

  // react-query v5 refetch is referentially stable.
  const { refetch: refetchFloor2 } = floor2;
  const { refetch: refetchFloor5 } = floor5;
  const { refetch: refetchFloor6 } = floor6;
  useLibrarySeatSse(
    2,
    useCallback(() => void refetchFloor2(), [refetchFloor2]),
  );
  useLibrarySeatSse(
    5,
    useCallback(() => void refetchFloor5(), [refetchFloor5]),
  );
  useLibrarySeatSse(
    6,
    useCallback(() => void refetchFloor6(), [refetchFloor6]),
  );

  const spaces: SpaceEntry[] = queries.flatMap((query) => {
    const data = query.data;
    if (!data) return [];
    return data.zones.map((zone) => ({
      key: `${data.floor}:${zone.label}`,
      floor: data.floor,
      floorLabel: data.floorLabel,
      zone,
    }));
  });

  const errorDetails = queries.map((q) => getErrorStateDetails(q.error));
  const needsAuth = errorDetails.some((d) => d?.code === "LIBRARY_SESSION_REQUIRED");
  const allFailed = queries.every((q) => q.error) && !needsAuth;
  const someFailed = queries.some((q) => q.error) && !allFailed && !needsAuth;
  const isLoading = queries.some((q) => q.isLoading) && spaces.length === 0 && !needsAuth;
  const firstError = errorDetails.find((d) => d !== null && d.code !== "LIBRARY_SESSION_REQUIRED");

  const refetchAll = useCallback(() => {
    void refetchFloor2();
    void refetchFloor5();
    void refetchFloor6();
  }, [refetchFloor2, refetchFloor5, refetchFloor6]);

  const currentSpace = spaces.find((s) => s.key === libSpace) ?? null;
  const effectiveView: LibView = libView === "space" && !currentSpace ? "overview" : libView;

  const seatTitle =
    effectiveView === "overview"
      ? "실시간 좌석 현황"
      : effectiveView === "all"
        ? "전체 좌석 현황"
        : (() => {
            const { name, floorTag } = splitZoneLabel(
              currentSpace!.zone.label,
              currentSpace!.floorLabel,
            );
            return `${name} (${floorTag})`;
          })();

  function openSpace(key: string) {
    setLibSpace(key);
    setLibView("space");
  }

  function scrollToRecommendations() {
    recommendationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleRegisterWait(floor: LibraryFloorCode) {
    try {
      await registerWaitMutation.mutateAsync({ preferredFloor: String(floor) });
      toast("success", "좌석 대기를 등록했어요. 자리가 나면 자동으로 예약을 시도해요.");
    } catch (err) {
      if (isLibraryAuthError(err)) {
        setShowLoginModal(true);
      } else {
        toast("error", "좌석 대기 등록에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-fadeUp">
      {/* ── 실시간 좌석 현황 ─────────────────────────────── */}
      <section
        aria-label="도서관 좌석 현황"
        className="rounded-card border border-hairline bg-surface p-5 shadow-e1"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {effectiveView !== "overview" ? (
              <button
                type="button"
                aria-label="뒤로 가기"
                onClick={() => setLibView("overview")}
                className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={17} aria-hidden />
              </button>
            ) : (
              <Armchair size={19} className="shrink-0 text-primary" aria-hidden />
            )}
            <h2 className="truncate text-[15px] font-extrabold text-foreground">{seatTitle}</h2>
          </div>
          {effectiveView === "overview" ? (
            <button
              type="button"
              onClick={() => setLibView("all")}
              className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] bg-primary-soft px-3 text-[12px] font-bold text-primary-soft-foreground"
            >
              <LayoutGrid size={15} aria-hidden />
              전체 보기
            </button>
          ) : null}
        </div>

        {isLoading ? <OverviewSkeleton /> : null}

        {needsAuth ? <ConnectGateCard onConnect={() => setShowLoginModal(true)} /> : null}

        {allFailed && firstError ? (
          <ErrorState
            code={firstError.code}
            message={firstError.message}
            traceId={firstError.traceId}
            onRetry={refetchAll}
          />
        ) : null}

        {!isLoading && !needsAuth && !allFailed && spaces.length > 0 ? (
          <>
            {someFailed ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-control bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning">
                일부 층 정보를 불러오지 못했어요.
                <Button variant="outline" size="sm" onClick={refetchAll}>
                  다시 시도
                </Button>
              </div>
            ) : null}

            {/* 오버뷰: 공간별 도넛 링 */}
            {effectiveView === "overview" ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {spaces.map((space) => {
                    const { name, floorTag } = splitZoneLabel(space.zone.label, space.floorLabel);
                    const badge = availabilityBadge(space.zone.available, space.zone.total);
                    return (
                      <button
                        key={space.key}
                        type="button"
                        onClick={() => openSpace(space.key)}
                        aria-label={`${space.zone.label} 좌석 ${space.zone.available}석 남음, 자세히 보기`}
                        className="press flex flex-col items-center rounded-card border border-hairline bg-surface p-4 text-center transition-shadow hover:shadow-e2"
                      >
                        <DonutGauge value={space.zone.available} max={space.zone.total} size={88} />
                        <p className="mt-2.5 truncate text-[13px] font-bold text-foreground">{name}</p>
                        <p className="text-[10.5px] text-subtle">{floorTag}</p>
                        <Badge variant={badge.variant} className="mt-2">
                          {badge.label}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-[11px] text-subtle">
                  공간을 누르면 좌석별 현황을 볼 수 있어요 · 30초마다 갱신
                </p>
              </>
            ) : null}

            {/* 공간 뷰: 좌석 dot 그리드 (per-seat 데이터가 있을 때) */}
            {effectiveView === "space" && currentSpace ? (
              <div className="flex flex-col gap-3.5">
                <div className="flex items-baseline justify-between gap-3 text-[12.5px] text-muted-foreground">
                  <span>
                    빈자리{" "}
                    <span className="font-mono font-bold text-success">
                      {currentSpace.zone.available}
                    </span>
                    석
                    {currentSpace.zone.seats.length > 0 ? " · 아래 추천 좌석에서 예약할 수 있어요" : null}
                  </span>
                  <span className="shrink-0 font-mono text-[12px]">
                    {currentSpace.zone.available} / {currentSpace.zone.total}
                  </span>
                </div>

                {currentSpace.zone.seats.length > 0 ? (
                  <>
                    <SeatDotGrid
                      zone={currentSpace.zone}
                      columns={10}
                    />
                    <SeatDotLegend />
                    <Button variant="outline" className="w-full" onClick={scrollToRecommendations}>
                      <Armchair size={16} aria-hidden />
                      추천 좌석 보기
                    </Button>
                  </>
                ) : (
                  <>
                    <ProgressBar
                      value={currentSpace.zone.available}
                      max={currentSpace.zone.total}
                      tone={progressTone(currentSpace.zone.available, currentSpace.zone.total)}
                      aria-label={`${currentSpace.zone.label} 잔여 좌석 비율`}
                    />
                    <div className="rounded-control bg-muted/60 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
                      이 공간은 좌석 단위 현황이 제공되지 않아요. 아래 추천 좌석으로 바로 예약할 수
                      있어요.
                    </div>
                  </>
                )}

                <div ref={recommendationRef} className="scroll-mt-20 border-t border-hairline pt-3.5">
                  <h3 className="mb-1 text-[13.5px] font-bold text-foreground">추천 좌석 예약</h3>
                  <SeatRecommendationPanel
                    floor={currentSpace.floor}
                    onReservationSuccess={refetchAll}
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={registerWaitMutation.isPending}
                  onClick={() => void handleRegisterWait(currentSpace.floor)}
                >
                  <Hourglass size={14} aria-hidden />
                  {registerWaitMutation.isPending
                    ? "대기 등록 중..."
                    : `이 층(${currentSpace.floorLabel}) 좌석 대기 등록`}
                </Button>
              </div>
            ) : null}

            {/* 전체 보기: 모든 공간 스택 */}
            {effectiveView === "all" ? (
              <div className="flex flex-col gap-3">
                {spaces.map((space) => {
                  const { name, floorTag } = splitZoneLabel(space.zone.label, space.floorLabel);
                  const badge = availabilityBadge(space.zone.available, space.zone.total);
                  return (
                    <div
                      key={space.key}
                      className="rounded-card border border-hairline bg-surface p-3.5"
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => openSpace(space.key)}
                          className="press flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="truncate text-[13px] font-bold text-foreground">
                            {name}
                          </span>
                          <span className="shrink-0 text-[10.5px] text-subtle">{floorTag}</span>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </button>
                        <span className="shrink-0 font-mono text-[12px] font-bold text-muted-foreground">
                          {space.zone.available} / {space.zone.total}
                        </span>
                      </div>
                      {space.zone.seats.length > 0 ? (
                        <SeatDotGrid
                          zone={space.zone}
                          columns={20}
                        />
                      ) : (
                        <ProgressBar
                          value={space.zone.available}
                          max={space.zone.total}
                          tone={progressTone(space.zone.available, space.zone.total)}
                          aria-label={`${space.zone.label} 잔여 좌석 비율`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}

        {!isLoading && !needsAuth && !allFailed && spaces.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            표시할 좌석 정보가 없습니다.
          </p>
        ) : null}
      </section>

      {/* ── 내 좌석/대기 · 대출 · 도서 검색 ────────────────── */}
      <section aria-label="도서관 이용 현황" className="grid gap-4 lg:grid-cols-2">
        {isConnected ? (
          <>
            <WaitStatusCard />
            <LibraryLoansCard />
          </>
        ) : needsAuth ? null : (
          // 좌석 섹션이 이미 연결 안내를 표시 중이면 중복 안내를 생략한다.
          <ConnectGateCard onConnect={() => setShowLoginModal(true)} />
        )}
        <LibraryBookSearchCard />
      </section>

      {showLoginModal ? <LibraryLoginModal onClose={() => setShowLoginModal(false)} /> : null}
    </div>
  );
}
