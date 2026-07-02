"use client";

import { Banknote, LogIn } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintScholarships } from "@/hooks/useSaintScholarships";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";
import { getSsoInitUrl } from "@/lib/api/auth";

function ScholarshipsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <div key={item} className="py-2">
          <Skeleton className="mb-1.5 h-4 w-2/3" />
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
  useSaintSessionGuard(errorState?.code);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Banknote size={19} className="text-primary" aria-hidden />
        <CardTitle>장학금 수혜 내역</CardTitle>
      </CardHeader>
      <CardContent>
        {authLoading && <ScholarshipsSkeleton />}

        {!authLoading && !isAuthenticated && (
          <div className="flex flex-col items-start gap-3 rounded-control bg-muted/60 p-4">
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
          <div className="rounded-control bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">
              세션이 만료됐어요. 잠시 후 자동으로 로그인 화면으로 이동합니다.
            </p>
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
              icon={<Banknote className="h-6 w-6" aria-hidden="true" />}
              title="수혜 장학금 이력이 없습니다"
              description="현재 조회된 장학금 내역이 없어요."
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {data.slice(0, 10).map((scholarship, index) => (
                <li
                  key={`${scholarship.year}-${scholarship.semester}-${scholarship.name}-${index}`}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {scholarship.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="font-mono font-semibold">
                        {scholarship.year}년 {scholarship.semester}
                      </Badge>
                      <Badge variant="outline">{scholarship.status}</Badge>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[13px] font-bold text-success">
                    {scholarship.receivedAmount.toLocaleString()}원
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
      </CardContent>
    </Card>
  );
}
