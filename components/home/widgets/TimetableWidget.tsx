"use client";

import { CalendarDays } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintSchedule } from "@/hooks/useSaintSchedule";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";
import type { ScheduleEntry } from "@/lib/api/types";

import { WidgetConnect, WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

const DAY_LABELS = ["월", "화", "수", "목", "금"] as const;

/** Stable per-course chip palette (token classes only). */
const COURSE_PALETTE = [
  "bg-primary-soft text-primary-soft-foreground",
  "bg-mint-50 text-mint-700 dark:bg-mint-700/20 dark:text-mint-300",
  "bg-warning-bg text-warning",
  "bg-success-bg text-success",
  "bg-danger-bg text-danger",
] as const;

/** span-2 widget: compact Mon–Fri course strip. */
export function TimetableWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintSchedule(accessToken);
  const errorState = getErrorStateDetails(error);
  useSaintSessionGuard(errorState?.code);

  const currentTerm = data?.terms.find(
    (t) => t.year === data.currentYear && t.term === data.currentTerm,
  );

  let body: React.ReactNode;
  if (authLoading || (isAuthenticated && isLoading)) {
    body = <WidgetSkeleton lines={3} />;
  } else if (!isAuthenticated) {
    body = <WidgetConnect provider="saint" />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (currentTerm) {
    const entries = currentTerm.entries;
    if (entries.length === 0) {
      body = <WidgetEmpty title="이번 학기 등록된 강의가 없어요" />;
    } else {
      const courses = [...new Set(entries.map((e) => e.course))];
      const colorOf = (course: string) =>
        COURSE_PALETTE[Math.max(0, courses.indexOf(course)) % COURSE_PALETTE.length];
      body = (
        <div className="grid grid-cols-5 gap-1.5">
          {DAY_LABELS.map((label, i) => {
            const day = i + 1;
            const dayEntries = entries
              .filter((e) => e.dayOfWeek === day)
              .sort((a: ScheduleEntry, b: ScheduleEntry) => a.period - b.period)
              .slice(0, 3);
            return (
              <div key={label} className="min-w-0 text-center">
                <p className="mb-1.5 text-[10.5px] font-bold text-muted-foreground">{label}</p>
                <div className="flex flex-col gap-1">
                  {dayEntries.length === 0 ? (
                    <div className="rounded-[7px] bg-muted/60 px-1 py-1.5 text-[10px] text-subtle">
                      -
                    </div>
                  ) : (
                    dayEntries.map((e) => (
                      <div
                        key={`${e.dayOfWeek}-${e.period}-${e.course}`}
                        title={`${e.course} · ${e.timeRange}${e.room ? ` · ${e.room}` : ""}`}
                        className={`truncate rounded-[7px] px-1 py-1.5 text-[10px] font-semibold ${colorOf(e.course)}`}
                      >
                        {e.course}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  } else {
    body = <WidgetEmpty title="시간표 정보가 없어요" />;
  }

  return (
    <WidgetFrame
      icon={CalendarDays}
      title="주간 시간표"
      headerRight={
        data ? (
          <span className="shrink-0 rounded-[6px] bg-muted px-1.5 py-0.5 text-[10.5px] text-subtle">
            {data.currentYear}-{data.currentTerm} 기준
          </span>
        ) : undefined
      }
    >
      {body}
    </WidgetFrame>
  );
}
