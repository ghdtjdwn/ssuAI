"use client";

import { GraduationCap, LogIn } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintScholarships } from "@/hooks/useSaintScholarships";
import { getSsoInitUrl } from "@/lib/api/auth";

function ScholarshipsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-md border border-border p-3">
          <Skeleton className="mb-1 h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ScholarshipsCard() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintScholarships(accessToken);
  const errorState = getErrorStateDetails(error);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>장학금</CardTitle>
        <CardDescription>수혜 이력</CardDescription>
      </CardHeader>
      <CardContent>
        {authLoading && <ScholarshipsSkeleton />}

        {!authLoading && !isAuthenticated && (
          <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              장학금 수혜 이력은 u-SAINT 로그인이 필요합니다.
            </p>
            <Button size="sm" onClick={() => (window.location.href = getSsoInitUrl())}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              SmartID 로그인
            </Button>
          </div>
        )}

        {isAuthenticated && isLoading && <ScholarshipsSkeleton />}

        {errorState && errorState.code === "SAINT_SESSION_EXPIRED" ? (
          <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              세션이 만료됐습니다. 다시 로그인하면 장학금 이력을 볼 수 있습니다.
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
          data.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-6 w-6" aria-hidden="true" />}
              title="수혜 장학금 이력이 없습니다"
              description="현재 조회된 장학금 내역이 없어요."
            />
          ) : (
            <ul className="space-y-2">
              {data.slice(0, 10).map((scholarship, index) => (
                <li
                  key={`${scholarship.year}-${scholarship.semester}-${scholarship.name}-${index}`}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{scholarship.name}</p>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {scholarship.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {scholarship.year}년 {scholarship.semester} ·{" "}
                    {scholarship.receivedAmount.toLocaleString()}원
                  </p>
                </li>
              ))}
            </ul>
          )
        )}
      </CardContent>
    </Card>
  );
}
