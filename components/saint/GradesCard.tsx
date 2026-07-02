"use client";

import { LogIn, Star } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintGrades } from "@/hooks/useSaintGrades";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";
import { getSsoInitUrl } from "@/lib/api/auth";

function GradesSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-16 w-full" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function GradesCard() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading } = useSaintGrades(accessToken);
  const errorState = getErrorStateDetails(error);
  useSaintSessionGuard(errorState?.code);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Star size={19} className="text-primary" aria-hidden />
        <CardTitle>누적 성적</CardTitle>
      </CardHeader>
      <CardContent>
        {authLoading && <GradesSkeleton />}

        {!authLoading && !isAuthenticated && (
          <div className="flex flex-col items-start gap-3 rounded-control bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">
              성적은 u-SAINT 로그인이 필요합니다.
            </p>
            <Button size="sm" onClick={() => (window.location.href = getSsoInitUrl())}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              SmartID 로그인
            </Button>
          </div>
        )}

        {isAuthenticated && isLoading && <GradesSkeleton />}

        {errorState && errorState.code === "SAINT_SESSION_EXPIRED" ? (
          <div className="rounded-control bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">
              세션이 만료됐어요. 잠시 후 자동으로 로그인 화면으로 이동합니다.
            </p>
          </div>
        ) : errorState ? (
          <ErrorState code={errorState.code} message={errorState.message} traceId={errorState.traceId} />
        ) : null}

        {data && !errorState && (
          <>
            <div className="mb-4">
              <p className="font-mono text-[30px] font-bold leading-none text-primary">
                {data.academicRecord.gpa.toFixed(2)}
                <span className="ml-1 text-sm font-semibold text-subtle">/ 4.5</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                취득{" "}
                <span className="font-mono font-semibold text-foreground">
                  {data.academicRecord.earnedCredits}
                </span>
                학점 · 신청{" "}
                <span className="font-mono font-semibold text-foreground">
                  {data.academicRecord.requestedCredits}
                </span>
                학점
              </p>
            </div>

            {data.history.length === 0 ? (
              <EmptyState
                icon={<Star className="h-6 w-6" aria-hidden="true" />}
                title="성적 내역이 없습니다"
                description="학기별 성적 정보를 가져올 수 없어요."
              />
            ) : (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {data.history.map((row) => (
                  <li
                    key={`${row.year}-${row.term}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="text-[12.5px] text-muted-foreground">
                      {row.year}년 {row.term}학기
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-subtle">
                        {row.earnedCredits}학점
                      </span>
                      <span className="font-mono text-[13px] font-bold text-foreground">
                        {row.gpa.toFixed(2)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
