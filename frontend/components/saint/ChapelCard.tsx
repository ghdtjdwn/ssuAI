"use client";

import { CalendarDays, LogIn } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintChapel } from "@/hooks/useSaintChapel";
import { getSsoInitUrl } from "@/lib/api/auth";

function ChapelSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <Skeleton key={item} className="h-10 w-full" />
      ))}
    </div>
  );
}

function resultVariant(result: string): BadgeProps["variant"] {
  if (result === "이수") return "default";
  if (result === "미이수") return "destructive";
  return "secondary";
}

export function ChapelCard() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintChapel(accessToken);
  const errorState = getErrorStateDetails(error);
  const recentAttendances = data
    ? [...data.attendances].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    : [];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>채플</CardTitle>
        <CardDescription>출석 현황</CardDescription>
      </CardHeader>
      <CardContent>
        {authLoading && <ChapelSkeleton />}

        {!authLoading && !isAuthenticated && (
          <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              채플 출석 현황은 u-SAINT 로그인이 필요합니다.
            </p>
            <Button size="sm" onClick={() => (window.location.href = getSsoInitUrl())}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              SmartID 로그인
            </Button>
          </div>
        )}

        {isAuthenticated && isLoading && <ChapelSkeleton />}

        {errorState && errorState.code === "SAINT_SESSION_EXPIRED" ? (
          <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              세션이 만료됐습니다. 다시 로그인하면 채플 현황을 볼 수 있습니다.
            </p>
            <Button size="sm" onClick={() => (window.location.href = getSsoInitUrl())}>
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
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <Badge variant={resultVariant(data.result)}>{data.result}</Badge>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">채플 시간</dt>
                  <dd className="text-right font-medium text-foreground">{data.chapelTime}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">강의실</dt>
                  <dd className="text-right font-medium text-foreground">{data.chapelRoom}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">결석</dt>
                  <dd className="text-right font-medium text-foreground">
                    {data.absenceUsedMinutes}분
                    {data.absenceAllowedMinutes === null
                      ? ""
                      : ` / ${data.absenceAllowedMinutes}분 허용`}
                  </dd>
                </div>
              </dl>
            </div>

            {recentAttendances.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
                title="출석 기록이 없습니다"
                description="현재 학기 채플 출석 기록을 찾을 수 없어요."
              />
            ) : (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">최근 출석 기록</p>
                <ul className="space-y-2">
                  {recentAttendances.map((attendance) => (
                    <li
                      key={`${attendance.date}-${attendance.title}`}
                      className="flex items-start justify-between gap-2 rounded-md border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{attendance.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {attendance.date}
                          {attendance.instructor ? ` · ${attendance.instructor}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {attendance.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
