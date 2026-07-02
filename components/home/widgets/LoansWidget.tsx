"use client";

import { BookOpen } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useLibraryLoans } from "@/hooks/useLibraryLoans";
import type { LibraryLoanItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { dDayLabel, daysUntil } from "../home-utils";
import { WidgetConnect, WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

function nearestDue(loans: LibraryLoanItem[]): LibraryLoanItem | null {
  return loans.reduce<LibraryLoanItem | null>(
    (best, loan) => (!best || loan.dueDate < best.dueDate ? loan : best),
    null,
  );
}

export function LoansWidget() {
  const { data, error, isLoading, refetch } = useLibraryLoans();
  const errorState = getErrorStateDetails(error);
  const needsAuth = errorState?.code === "LIBRARY_SESSION_REQUIRED";

  let body: React.ReactNode;
  if (needsAuth) {
    body = <WidgetConnect provider="library" />;
  } else if (isLoading) {
    body = <WidgetSkeleton lines={2} />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (data) {
    const nearest = nearestDue(data.loans);
    const overdue = data.loans.filter((l) => l.isOverdue).length;
    if (!nearest) {
      body = <WidgetEmpty title="대출 중인 도서가 없어요" />;
    } else {
      const dday = daysUntil(nearest.dueDate);
      body = (
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {nearest.title}
              </p>
              <p className="truncate text-[11px] text-subtle">
                반납 {nearest.dueDate}
                {nearest.author ? ` · ${nearest.author}` : ""}
              </p>
            </div>
            {dday !== null ? (
              <span
                className={cn(
                  "shrink-0 rounded-[7px] px-2 py-0.5 font-mono text-[11px] font-bold",
                  nearest.isOverdue || dday < 0
                    ? "bg-danger-bg text-danger"
                    : dday <= 3
                      ? "bg-warning-bg text-warning"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {dDayLabel(dday)}
              </span>
            ) : null}
          </div>
          <p className="mt-2.5 text-[11px] text-subtle">
            대출 <span className="font-mono font-bold">{data.total}</span> · 연체{" "}
            <span className={cn("font-mono font-bold", overdue > 0 && "text-danger")}>
              {overdue}
            </span>
          </p>
        </div>
      );
    }
  } else {
    body = <WidgetSkeleton lines={2} />;
  }

  return (
    <WidgetFrame icon={BookOpen} title="대출 현황">
      {body}
    </WidgetFrame>
  );
}
