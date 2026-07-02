"use client";

import { LogIn, MonitorPlay } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLmsAssignments } from "@/hooks/useLmsAssignments";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { getLmsSsoInitUrl } from "@/lib/api/auth";

function AssignmentsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="py-2">
          <Skeleton className="mb-1.5 h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

function typeLabel(type: string) {
  if (type === "quiz") return "퀴즈";
  if (type === "assignment") return "과제";
  return type;
}

function formatDue(dueDate: string | null) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return dueDate;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Day-based D-day: warning within 3 days, destructive when overdue. */
function dueBadge(dueDate: string | null): { label: string; variant: BadgeProps["variant"] } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
  if (diffDays < 0) return { label: `D+${Math.abs(diffDays)}`, variant: "destructive" };
  if (diffDays <= 3) return { label: `D-${diffDays}`, variant: "warning" };
  return { label: `D-${diffDays}`, variant: "secondary" };
}

export function AssignmentsCard() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useLmsAssignments(accessToken);
  const errorState = getErrorStateDetails(error);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <MonitorPlay size={19} className="text-primary" aria-hidden />
          <CardTitle>LMS 과제</CardTitle>
        </div>
        <span className="text-xs text-subtle">미제출 과제 및 퀴즈</span>
      </CardHeader>
      <CardContent>
        {authLoading && <AssignmentsSkeleton />}

        {!authLoading && !isAuthenticated && (
          <div className="flex flex-col items-start gap-3 rounded-control bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">
              LMS 과제는 로그인이 필요합니다.
            </p>
            <Button size="sm" onClick={() => (window.location.href = getLmsSsoInitUrl())}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              SmartID 로그인
            </Button>
          </div>
        )}

        {isAuthenticated && isLoading && <AssignmentsSkeleton />}

        {errorState &&
        (errorState.code === "LMS_SESSION_EXPIRED" || errorState.code === "LMS_AUTH_FAILED") ? (
          <div className="flex flex-col items-start gap-3 rounded-control bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">
              LMS 세션이 만료됐습니다. 다시 로그인하면 과제 현황을 볼 수 있습니다.
            </p>
            <Button size="sm" onClick={() => (window.location.href = getLmsSsoInitUrl())}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              다시 로그인
            </Button>
          </div>
        ) : errorState ? (
          <ErrorState
            code={errorState.code}
            message={errorState.message}
            traceId={errorState.traceId}
            onRetry={() => void refetch()}
          />
        ) : null}

        {data && !errorState && (
          data.items.length === 0 ? (
            <EmptyState
              icon={<MonitorPlay className="h-6 w-6" aria-hidden="true" />}
              title="미제출 과제가 없습니다"
              description="현재 제출해야 할 과제나 퀴즈가 없어요."
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {data.items.map((item) => {
                const due = formatDue(item.dueDate);
                const dday = dueBadge(item.dueDate);
                return (
                  <li
                    key={`${item.courseName}-${item.title}-${item.dueDate ?? "no-due"}`}
                    className="py-2.5 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-subtle">{item.courseName}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {dday ? (
                          <Badge variant={dday.variant} className="font-mono">
                            {dday.label}
                          </Badge>
                        ) : null}
                        <Badge variant="outline">{typeLabel(item.type)}</Badge>
                      </div>
                    </div>
                    {due && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        마감: <span className="font-mono">{due}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        )}
      </CardContent>
    </Card>
  );
}
