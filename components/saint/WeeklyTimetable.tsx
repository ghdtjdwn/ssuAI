"use client";

import { CalendarRange } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintSchedule } from "@/hooks/useSaintSchedule";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";
import type { ScheduleEntry, TermSchedule } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = [1, 2, 3, 4, 5] as const;
const DAY_LABELS = ["", "월", "화", "수", "목", "금", "토", "일"];

interface CourseTone {
  border: string;
  bg: string;
  time: string;
}

/** Token-only course palette; a stable tone per course via name hash. */
const COURSE_TONES: CourseTone[] = [
  {
    border: "border-l-primary",
    bg: "bg-primary-soft",
    time: "text-primary-soft-foreground",
  },
  {
    border: "border-l-mint",
    bg: "bg-mint-50 dark:bg-mint-700/25",
    time: "text-mint-700 dark:text-mint-300",
  },
  {
    border: "border-l-success",
    bg: "bg-success-bg",
    time: "text-success",
  },
  {
    border: "border-l-warning",
    bg: "bg-warning-bg",
    time: "text-warning",
  },
  {
    border: "border-l-primary-300",
    bg: "bg-primary-50 dark:bg-primary-800/40",
    time: "text-primary-400 dark:text-primary-200",
  },
  {
    border: "border-l-mint-300",
    bg: "bg-mint-50/60 dark:bg-mint-600/15",
    time: "text-mint-600 dark:text-mint-100",
  },
];

/** Hash the course name so the same course always gets the same tone. */
export function courseTone(course: string): CourseTone {
  let hash = 0;
  for (let i = 0; i < course.length; i += 1) {
    hash = (hash * 31 + course.charCodeAt(i)) >>> 0;
  }
  return COURSE_TONES[hash % COURSE_TONES.length];
}

function groupByDay(entries: ScheduleEntry[]): Map<number, ScheduleEntry[]> {
  const map = new Map<number, ScheduleEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.dayOfWeek) ?? [];
    list.push(entry);
    map.set(entry.dayOfWeek, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.period - b.period);
  }
  return map;
}

/** Weekday numbers (1=월 … 5=금) rotated so today (or Monday on weekends) comes first. */
function mobileDayOrder(todayDow: number): number[] {
  const start = todayDow >= 1 && todayDow <= 5 ? todayDow : 1;
  return WEEKDAYS.map((_, i) => ((start - 1 + i) % 5) + 1);
}

function CourseBlock({ entry }: { entry: ScheduleEntry }) {
  const tone = courseTone(entry.course);
  return (
    <div className={cn("rounded-[8px] border-l-[3px] px-2.5 py-2", tone.border, tone.bg)}>
      <p className={cn("font-mono text-[10.5px] font-semibold leading-none", tone.time)}>
        {entry.timeRange}
      </p>
      <p className="mt-1.5 text-[12.5px] font-semibold leading-tight text-foreground">
        {entry.course}
      </p>
      {entry.room ? <p className="mt-0.5 text-[10.5px] text-subtle">{entry.room}</p> : null}
    </div>
  );
}

function TimetableSkeleton() {
  return (
    <>
      <div className="hidden gap-2 md:grid md:grid-cols-5">
        {WEEKDAYS.map((day) => (
          <div key={day} className="space-y-1.5">
            <Skeleton className="mx-auto h-4 w-8" />
            <Skeleton className="h-16 w-full rounded-[8px]" />
            <Skeleton className="h-16 w-full rounded-[8px]" />
          </div>
        ))}
      </div>
      <div className="space-y-2 md:hidden">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-[8px]" />
        ))}
      </div>
    </>
  );
}

/**
 * 학사 탭 주간 시간표 — 월–금 5-col grid on desktop, today-first
 * day list on mobile (design handoff §3).
 */
export function WeeklyTimetable() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintSchedule(accessToken);
  const errorState = getErrorStateDetails(error);
  useSaintSessionGuard(errorState?.code);

  // Exact current-term match first; outside regular semesters (e.g. 여름학기)
  // fall back to the most recent term so the grid still shows something.
  const term: TermSchedule | undefined =
    data?.terms.find((t) => t.year === data.currentYear && t.term === data.currentTerm) ??
    data?.terms[data.terms.length - 1];

  const byDay = term ? groupByDay(term.entries) : new Map<number, ScheduleEntry[]>();
  const todayDow = new Date().getDay();
  const dayOrder = mobileDayOrder(todayDow);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CalendarRange size={19} className="text-primary" aria-hidden />
          <CardTitle>주간 시간표</CardTitle>
        </div>
        {term ? (
          <span className="rounded-[7px] bg-muted px-2 py-1 font-mono text-[11px] font-medium text-subtle">
            {term.year}-{term.term}학기
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {(authLoading || (isAuthenticated && isLoading)) && <TimetableSkeleton />}

        {!authLoading && !isAuthenticated && (
          <p className="rounded-control bg-muted/60 p-4 text-sm text-muted-foreground">
            시간표는 u-SAINT 로그인이 필요합니다.
          </p>
        )}

        {errorState && errorState.code === "SAINT_SESSION_EXPIRED" ? (
          <div className="rounded-control bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">
              세션이 만료됐어요. 잠시 후 자동으로 로그인 화면으로 이동합니다.
            </p>
          </div>
        ) : errorState ? (
          <ErrorState
            code={errorState.code}
            message={errorState.message}
            traceId={errorState.traceId}
            onRetry={() => void refetch()}
          />
        ) : null}

        {term && !errorState && !isLoading && (
          byDay.size === 0 ? (
            <EmptyState
              icon={<CalendarRange className="h-6 w-6" aria-hidden="true" />}
              title="이번 학기 강의가 없습니다"
              description="현재 학기 등록 강의를 찾을 수 없어요."
            />
          ) : (
            <>
              {/* Desktop: 월–금 5-column grid */}
              <div className="hidden gap-2 md:grid md:grid-cols-5">
                {WEEKDAYS.map((day) => (
                  <div key={day}>
                    <p
                      className={cn(
                        "mb-1.5 text-center text-[12px] font-bold",
                        day === todayDow ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {DAY_LABELS[day]}
                    </p>
                    <div className="space-y-1.5">
                      {(byDay.get(day) ?? []).map((entry) => (
                        <CourseBlock key={`${entry.dayOfWeek}-${entry.period}`} entry={entry} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile: today-first day-by-day list */}
              <div className="space-y-4 md:hidden">
                {dayOrder
                  .filter((day) => (byDay.get(day) ?? []).length > 0)
                  .map((day) => (
                    <div key={day}>
                      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
                        {DAY_LABELS[day]}요일
                        {day === todayDow ? <Badge>오늘</Badge> : null}
                      </div>
                      <div className="space-y-1.5">
                        {(byDay.get(day) ?? []).map((entry) => (
                          <CourseBlock key={`${entry.dayOfWeek}-${entry.period}`} entry={entry} />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )
        )}
      </CardContent>
    </Card>
  );
}
