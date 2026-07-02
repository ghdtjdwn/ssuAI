"use client";

import { CalendarClock } from "lucide-react";
import { Fragment } from "react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useLmsAssignments } from "@/hooks/useLmsAssignments";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import type { AssignmentItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { dDayLabel, daysUntil } from "../home-utils";
import { WidgetConnect, WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

interface DueItem extends AssignmentItem {
  dday: number;
}

export function upcomingDeadlines(items: AssignmentItem[], limit: number): DueItem[] {
  return items
    .map((item) => ({ item, dday: item.dueDate ? daysUntil(item.dueDate) : null }))
    .filter((x): x is { item: AssignmentItem; dday: number } => x.dday !== null && x.dday >= 0)
    .sort((a, b) => a.dday - b.dday)
    .slice(0, limit)
    .map(({ item, dday }) => ({ ...item, dday }));
}

export function DeadlineWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useLmsAssignments(accessToken);
  const errorState = getErrorStateDetails(error);
  const lmsSessionLost =
    errorState?.code === "LMS_SESSION_EXPIRED" || errorState?.code === "LMS_AUTH_FAILED";

  let body: React.ReactNode;
  if (authLoading || (isAuthenticated && isLoading)) {
    body = <WidgetSkeleton lines={3} />;
  } else if (!isAuthenticated || lmsSessionLost) {
    body = <WidgetConnect provider="lms" />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (data) {
    const due = upcomingDeadlines(data.items, 3);
    body =
      due.length === 0 ? (
        <WidgetEmpty title="다가오는 마감이 없어요" sub="미제출 과제가 없어요" />
      ) : (
        <div className="flex flex-col gap-2">
          {due.map((item, i) => (
            <Fragment key={`${item.courseName}-${item.title}-${item.dueDate}`}>
              {i > 0 ? <div className="h-px bg-hairline" /> : null}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-foreground">{item.title}</p>
                  <p className="truncate text-[11px] text-subtle">{item.courseName}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-[7px] px-1.5 py-0.5 font-mono text-[11.5px] font-bold",
                    item.dday <= 3
                      ? "bg-warning-bg text-warning"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {dDayLabel(item.dday)}
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
    <WidgetFrame icon={CalendarClock} title="마감 D-day">
      {body}
    </WidgetFrame>
  );
}
