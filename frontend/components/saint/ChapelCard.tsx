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
import type { ChapelInfo } from "@/lib/api/types";

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

function AbsenceStatus({ chapel }: { chapel: ChapelInfo }) {
  if (chapel.result === "이수") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
        <span aria-hidden="true">✓</span>
        <span>이수 완료</span>
      </div>
    );
  }

  if (chapel.absenceAllowedMinutes === null) {
    return null;
  }

  const remaining = chapel.absenceAllowedMinutes - chapel.absenceUsedMinutes;
  if (remaining <= 0) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
        결석 한도 도달 - 이제 한 번 더 빠지면 미이수!
      </div>
    );
  }

  return (
    <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
      결석 {remaining}번 더 가능
    </div>
  );
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
                {data.seatNumber ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">좌석번호</dt>
                    <dd className="text-right font-medium text-foreground">{data.seatNumber}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">결석</dt>
                  <dd className="text-right font-medium text-foreground">
                    {data.absenceUsedMinutes}회
                    {data.absenceAllowedMinutes === null
                      ? ""
                      : ` / 최대 ${data.absenceAllowedMinutes}회`}
                  </dd>
                </div>
              </dl>
            </div>

            <AbsenceStatus chapel={data} />

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

            {data.absenceApplications.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">결석 신청 이력</p>
                <ul className="space-y-2">
                  {data.absenceApplications.map((application, index) => (
                    <li
                      key={`${application.startDate}-${application.reason}-${index}`}
                      className="flex items-start justify-between gap-2 rounded-md border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{application.reason}</p>
                        <p className="text-xs text-muted-foreground">
                          {application.startDate} ~ {application.endDate} · {application.category}
                        </p>
                      </div>
                      <Badge
                        variant={
                          application.status === "승인"
                            ? "default"
                            : application.status === "거부"
                              ? "destructive"
                              : "secondary"
                        }
                        className="shrink-0 text-xs"
                      >
                        {application.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
