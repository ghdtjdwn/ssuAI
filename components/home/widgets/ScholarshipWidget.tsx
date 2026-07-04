"use client";

import { Banknote } from "lucide-react";
import { Fragment } from "react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintScholarships } from "@/hooks/useSaintScholarships";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";
import type { ScholarshipEntry } from "@/lib/api/types";
import { formatCount } from "@/lib/utils";

import { WidgetConnect, WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

function latestTwo(entries: ScholarshipEntry[]): ScholarshipEntry[] {
  return [...entries]
    .sort((a, b) => b.year - a.year || b.semester.localeCompare(a.semester))
    .slice(0, 2);
}

export function ScholarshipWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintScholarships(accessToken);
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
    const latest = latestTwo(data);
    body =
      latest.length === 0 ? (
        <WidgetEmpty title="장학 수혜 내역이 없어요" />
      ) : (
        <div className="flex flex-col gap-2">
          {latest.map((entry, i) => (
            <Fragment key={`${entry.year}-${entry.semester}-${entry.name}`}>
              {i > 0 ? <div className="h-px bg-hairline" /> : null}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] text-foreground">{entry.name}</p>
                  <p className="text-[11px] text-subtle">
                    {entry.year} {entry.semester}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[12.5px] font-bold text-success">
                  {formatCount(entry.receivedAmount)}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      );
  } else {
    body = <WidgetSkeleton lines={2} />;
  }

  return (
    <WidgetFrame icon={Banknote} title="장학금">
      {body}
    </WidgetFrame>
  );
}
