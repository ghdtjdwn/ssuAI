"use client";

import { Calendar } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintSchedule } from "@/hooks/useSaintSchedule";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";
import type { ScheduleEntry } from "@/lib/api/types";

import { parseStartTime, seoulIsoWeekday, seoulTimeHM } from "../home-utils";
import { WidgetConnect, WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

function pickNextClass(entries: ScheduleEntry[]): {
  next: ScheduleEntry | null;
  hadClassesToday: boolean;
} {
  const today = seoulIsoWeekday();
  const nowHM = seoulTimeHM();
  const todays = entries
    .filter((e) => e.dayOfWeek === today)
    .sort((a, b) => a.period - b.period);
  const next =
    todays.find((e) => {
      const start = parseStartTime(e.timeRange);
      return start !== null && start >= nowHM;
    }) ?? null;
  return { next, hadClassesToday: todays.length > 0 };
}

export function NextScheduleWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintSchedule(accessToken);
  const errorState = getErrorStateDetails(error);
  useSaintSessionGuard(errorState?.code);

  let body: React.ReactNode;
  if (authLoading || (isAuthenticated && isLoading)) {
    body = <WidgetSkeleton lines={2} />;
  } else if (!isAuthenticated) {
    body = <WidgetConnect provider="saint" />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (data) {
    const currentTerm = data.terms.find(
      (t) => t.year === data.currentYear && t.term === data.currentTerm,
    );
    const { next, hadClassesToday } = pickNextClass(currentTerm?.entries ?? []);

    if (next) {
      body = (
        <div>
          <div className="font-mono text-[15px] font-bold text-primary">{next.timeRange}</div>
          <p className="mt-1 truncate text-[14px] font-bold text-foreground">{next.course}</p>
          <div className="mt-2 flex items-center justify-between rounded-control bg-muted px-3 py-2">
            <span className="text-[12px] text-muted-foreground">강의실</span>
            <span className="text-[12px] font-semibold text-foreground">{next.room || "-"}</span>
          </div>
        </div>
      );
    } else {
      body = (
        <WidgetEmpty
          title={hadClassesToday ? "오늘 수업은 모두 끝났어요" : "오늘 예정된 수업이 없어요"}
          sub={hadClassesToday ? "수고했어요!" : "여유로운 하루 보내세요"}
        />
      );
    }
  } else {
    body = <WidgetSkeleton lines={2} />;
  }

  return (
    <WidgetFrame icon={Calendar} title="오늘 · 다음 일정">
      {body}
    </WidgetFrame>
  );
}
