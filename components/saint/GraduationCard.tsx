"use client";

import { GraduationCap, LogIn } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintGraduation } from "@/hooks/useSaintGraduation";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";
import { getSsoInitUrl } from "@/lib/api/auth";

function GraduationSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-20 w-full" />
      {[1, 2].map((item) => (
        <Skeleton key={item} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function GraduationCard() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintGraduation(accessToken);
  const errorState = getErrorStateDetails(error);
  useSaintSessionGuard(errorState?.code);
  const unmetRequirements = data?.requirements.filter((requirement) => !requirement.satisfied) ?? [];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>졸업 요건</CardTitle>
        <CardDescription>이수 현황</CardDescription>
      </CardHeader>
      <CardContent>
        {authLoading && <GraduationSkeleton />}

        {!authLoading && !isAuthenticated && (
          <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              졸업 요건은 u-SAINT 로그인이 필요합니다.
            </p>
            <Button size="sm" onClick={() => (window.location.href = getSsoInitUrl())}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              SmartID 로그인
            </Button>
          </div>
        )}

        {isAuthenticated && isLoading && <GraduationSkeleton />}

        {errorState && errorState.code === "SAINT_SESSION_EXPIRED" ? (
          <div className="rounded-md border border-border bg-muted/40 p-4">
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
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <Badge variant={data.isGraduatable ? "default" : "destructive"}>
                {data.isGraduatable ? "졸업 가능" : "요건 미충족"}
              </Badge>
              <p className="mt-3 text-xs text-muted-foreground">취득 학점</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {data.completedPoints} / {data.graduationPoints}
                <span className="ml-1 text-sm font-normal text-muted-foreground">학점</span>
              </p>
            </div>

            {unmetRequirements.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="h-6 w-6" aria-hidden="true" />}
                title="모든 요건을 충족했습니다"
                description="현재 확인된 미충족 졸업 요건이 없어요."
              />
            ) : (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">미충족 항목</p>
                <ul className="space-y-2">
                  {unmetRequirements.map((requirement) => (
                    <li
                      key={`${requirement.category}-${requirement.name}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground">{requirement.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {requirement.remaining}학점 남음
                      </span>
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
