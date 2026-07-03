"use client";

import { CalendarDays } from "lucide-react";
import { Fragment } from "react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useAcademicCalendar } from "@/hooks/useAcademicCalendar";
import type { AcademicCalendarEvent } from "@/lib/api/calendar";
import { getSeoulDateString } from "@/lib/utils";

import { WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

/** Events from today onward, soonest first; falls back to the latest past events. */
function upcoming(events: AcademicCalendarEvent[], limit: number): AcademicCalendarEvent[] {
  const today = getSeoulDateString();
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const ahead = sorted.filter((e) => e.date >= today);
  return (ahead.length > 0 ? ahead : sorted.slice(-limit)).slice(0, limit);
}

function ddayLabel(dateIso: string): string {
  const today = getSeoulDateString();
  if (dateIso === today) return "D-day";
  const diff = Math.round(
    (Date.parse(`${dateIso}T00:00:00+09:00`) - Date.parse(`${today}T00:00:00+09:00`)) / 86_400_000,
  );
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

export function CalendarWidget() {
  const { data, error, isLoading, refetch } = useAcademicCalendar();
  const errorState = getErrorStateDetails(error);

  let body: React.ReactNode;
  if (isLoading) {
    body = <WidgetSkeleton lines={3} />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (data) {
    const items = upcoming(data.events, 3);
    body =
      items.length === 0 ? (
        <WidgetEmpty title="학사일정 정보가 없어요" />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <Fragment key={`${item.date}-${i}`}>
              {i > 0 ? <div className="h-px bg-hairline" /> : null}
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-[12.5px] leading-normal text-foreground">
                  {item.event}
                </span>
                <span className="shrink-0 font-mono text-[11px] font-bold text-primary">
                  {ddayLabel(item.date)}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      );
  } else {
    body = <WidgetSkeleton lines={3} />;
  }

  return (
    <WidgetFrame icon={CalendarDays} title="학사일정">
      {body}
    </WidgetFrame>
  );
}
