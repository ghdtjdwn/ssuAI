"use client";

import { CalendarDays } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcademicCalendar } from "@/hooks/useAcademicCalendar";
import type { AcademicCalendarEvent } from "@/lib/api/calendar";
import { getSeoulDateString } from "@/lib/utils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [, month, day] = parts;
  const weekday = WEEKDAYS[new Date(`${iso}T00:00:00+09:00`).getDay()] ?? "";
  return `${month}.${day} (${weekday})`;
}

/** Upcoming events (today onward) first; falls back to the latest past events. */
function pickEvents(events: AcademicCalendarEvent[], limit: number): AcademicCalendarEvent[] {
  const today = getSeoulDateString();
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const ahead = sorted.filter((e) => e.date >= today);
  return (ahead.length > 0 ? ahead : sorted.slice(-limit)).slice(0, limit);
}

export function AcademicCalendarCard() {
  const { data, error, isLoading, refetch } = useAcademicCalendar();
  const errorState = getErrorStateDetails(error);
  const today = getSeoulDateString();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5">
          <CalendarDays size={16} className="text-muted-foreground" aria-hidden="true" />
          학사일정
        </CardTitle>
        {data ? (
          <span className="font-mono text-[11px] font-bold text-subtle">{data.year}</span>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2.5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : errorState ? (
          <div className="flex items-center justify-between gap-2 rounded-control bg-muted px-3 py-2.5">
            <p className="text-[13px] text-muted-foreground">학사일정을 불러오지 못했어요</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="press rounded-control px-2 py-1 text-[12.5px] font-bold text-primary hover:bg-primary-soft"
            >
              다시 시도
            </button>
          </div>
        ) : (
          (() => {
            const items = pickEvents(data?.events ?? [], 8);
            if (items.length === 0) {
              return (
                <p className="py-3 text-center text-[13px] text-muted-foreground">
                  학사일정 정보가 없어요
                </p>
              );
            }
            return (
              <ul className="flex flex-col">
                {items.map((item, i) => {
                  const isToday = item.date === today;
                  return (
                    <li
                      key={`${item.date}-${i}`}
                      className={`flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0 ${
                        isToday ? "text-primary" : ""
                      }`}
                    >
                      <span
                        className={`shrink-0 font-mono text-[12px] font-bold ${
                          isToday ? "text-primary" : "text-subtle"
                        }`}
                      >
                        {formatDate(item.date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                        {item.event}
                      </span>
                    </li>
                  );
                })}
              </ul>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}
