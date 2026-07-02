"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";

import { useLmsAssignments } from "@/hooks/useLmsAssignments";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintGraduation } from "@/hooks/useSaintGraduation";

import {
  daysUntil,
  findMajorRequirement,
  findRequirement,
  greetingForHour,
} from "./home-utils";
import { useLibraryZones } from "./useLibraryZones";

/** Query-key prefixes the refresh button invalidates (everything home shows). */
const HOME_QUERY_KEYS: readonly (readonly string[])[] = [
  ["saint"],
  ["lms"],
  ["library", "seats"],
  ["library", "loans"],
  ["meal"],
  ["dorm"],
  ["notices"],
];

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[8px] bg-white/10 px-2.5 py-1.5 font-mono text-[11.5px] font-semibold text-primary-50">
      {children}
    </span>
  );
}

function ChipSkeleton() {
  return <span className="h-[29px] w-24 animate-pulse rounded-[8px] bg-white/10" aria-hidden />;
}

export function BriefingHero() {
  const queryClient = useQueryClient();
  const { user, accessToken, isAuthenticated } = useSaintAuth();
  const gradQ = useSaintGraduation(accessToken);
  const lmsQ = useLmsAssignments(accessToken);
  const { bestZone } = useLibraryZones();
  const [refreshing, setRefreshing] = useState(false);

  const grad = gradQ.data;
  const remainingPoints = grad
    ? Math.max(0, grad.graduationPoints - grad.completedPoints)
    : null;
  const majorReq = findMajorRequirement(grad);
  const chapelReq = findRequirement(grad, "채플");

  // Rule-based one-line briefing from live data; unconnected sources are
  // silently omitted (no fake numbers).
  const dueSoonCount = (lmsQ.data?.items ?? []).filter((item) => {
    const d = item.dueDate ? daysUntil(item.dueDate) : null;
    return d !== null && d >= 0 && d <= 7;
  }).length;

  const parts: string[] = [];
  if (lmsQ.data) {
    parts.push(
      dueSoonCount > 0
        ? `7일 안에 마감되는 과제가 ${dueSoonCount}건 있어요`
        : "이번 주 마감 과제는 없어요",
    );
  }
  if (chapelReq && chapelReq.remaining > 0) {
    parts.push(`채플이 ${chapelReq.remaining}회 남았어요`);
  }
  if (bestZone && bestZone.available > 0) {
    parts.push(`${bestZone.label}에 여유 좌석 ${bestZone.available}석`);
  }
  const summary =
    parts.length > 0
      ? `${parts.join(" · ")}.`
      : isAuthenticated
        ? "오늘도 차분하게 시작해봐요. 아래 요약에서 하루를 확인하세요."
        : "u-SAINT·LMS·도서관을 연결하면 나에게 맞는 브리핑을 만들어드려요.";

  const greeting = user
    ? `${greetingForHour(new Date().getHours())}, ${user.name}님`
    : "환영해요!";

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        ...HOME_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey: [...queryKey] }),
        ),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const showChips = isAuthenticated && !!grad;

  return (
    <section className="hero-gradient relative overflow-hidden rounded-hero px-5 py-5 text-white shadow-e2 sm:px-6 sm:py-6">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-2.5 py-1 text-[11.5px] font-bold text-primary-100">
            <Sparkles size={14} className="shrink-0 text-mint-glow-soft" aria-hidden />
            AI 오늘의 브리핑
          </span>
          <h2
            className="mt-3 text-[21px] font-extrabold tracking-[-0.02em] sm:text-[25px]"
            suppressHydrationWarning
          >
            {greeting}
          </h2>
          {refreshing ? (
            <span
              className="mt-2 block h-5 w-64 max-w-full animate-pulse rounded bg-white/10"
              aria-hidden
            />
          ) : (
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-primary-100 sm:text-[13.5px]">
              {summary}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="press inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-control border border-white/25 bg-white/10 px-3 text-[12.5px] font-semibold text-white hover:bg-white/15 disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : undefined} aria-hidden />
          <span className="hidden sm:inline">새로고침</span>
        </button>
      </div>
      {showChips || refreshing ? (
        <div className="relative mt-4 flex flex-wrap gap-2">
          {refreshing ? (
            <>
              <ChipSkeleton />
              <ChipSkeleton />
              <ChipSkeleton />
            </>
          ) : (
            <>
              {remainingPoints !== null ? (
                <StatChip>졸업까지 {remainingPoints}학점</StatChip>
              ) : null}
              {majorReq ? <StatChip>전공 {majorReq.remaining}</StatChip> : null}
              {chapelReq ? <StatChip>채플 {chapelReq.remaining}회</StatChip> : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
