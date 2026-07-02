"use client";

import { MonitorPlay } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useLmsAssignments } from "@/hooks/useLmsAssignments";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { cn } from "@/lib/utils";

import { daysUntil } from "../home-utils";
import { WidgetConnect, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

/**
 * Count summary of unsubmitted LMS work. The design also showed a
 * "강의자료" count, but lib/api has no materials endpoint — we show
 * a 7-day due count instead of faking it.
 */
export function LmsWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useLmsAssignments(accessToken);
  const errorState = getErrorStateDetails(error);
  const lmsSessionLost =
    errorState?.code === "LMS_SESSION_EXPIRED" || errorState?.code === "LMS_AUTH_FAILED";

  let body: React.ReactNode;
  if (authLoading || (isAuthenticated && isLoading)) {
    body = <WidgetSkeleton lines={2} />;
  } else if (!isAuthenticated || lmsSessionLost) {
    body = <WidgetConnect provider="lms" />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (data) {
    const total = data.items.length;
    const dueThisWeek = data.items.filter((item) => {
      const d = item.dueDate ? daysUntil(item.dueDate) : null;
      return d !== null && d >= 0 && d <= 7;
    }).length;
    body = (
      <div className="flex gap-2.5">
        <div className="flex-1 rounded-control bg-muted px-2.5 py-2.5">
          <div
            className={cn(
              "font-mono text-[18px] font-bold",
              total > 0 ? "text-primary" : "text-foreground",
            )}
          >
            {total}
          </div>
          <div className="mt-0.5 text-[10.5px] text-subtle">미제출 과제·퀴즈</div>
        </div>
        <div className="flex-1 rounded-control bg-muted px-2.5 py-2.5">
          <div
            className={cn(
              "font-mono text-[18px] font-bold",
              dueThisWeek > 0 ? "text-warning" : "text-foreground",
            )}
          >
            {dueThisWeek}
          </div>
          <div className="mt-0.5 text-[10.5px] text-subtle">7일 내 마감</div>
        </div>
      </div>
    );
  } else {
    body = <WidgetSkeleton lines={2} />;
  }

  return (
    <WidgetFrame icon={MonitorPlay} title="LMS 과제·자료">
      {body}
    </WidgetFrame>
  );
}
