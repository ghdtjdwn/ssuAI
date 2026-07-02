"use client";

import { Award, LogIn } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintGraduation } from "@/hooks/useSaintGraduation";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";
import { getSsoInitUrl } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

function GraduationSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {[1, 2, 3].map((item) => (
        <Skeleton key={item} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function GraduationCard() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintGraduation(accessToken);
  const errorState = getErrorStateDetails(error);
  useSaintSessionGuard(errorState?.code);

  // Credit-like requirements (전공, 전공필수, 채플…) render as progress bars;
  // boolean-ish ones (논문, 확정신고…) render as unmet badges below.
  const creditRequirements = data?.requirements.filter((r) => r.required > 1) ?? [];
  const unmetFlags = data?.requirements.filter((r) => !r.satisfied && r.required <= 1) ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Award size={19} className="text-primary" aria-hidden />
          <CardTitle>졸업 요건</CardTitle>
        </div>
        {data && !errorState ? (
          <Badge variant={data.isGraduatable ? "success" : "destructive"}>
            {data.isGraduatable ? "졸업 가능" : "요건 미충족"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {authLoading && <GraduationSkeleton />}

        {!authLoading && !isAuthenticated && (
          <div className="flex flex-col items-start gap-3 rounded-control bg-muted/60 p-4">
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
          <div className="space-y-4">
            {/* 총 취득학점 */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[12.5px] font-semibold text-foreground">총 취득학점</span>
                <span className="font-mono text-[12.5px] font-bold text-primary">
                  {data.completedPoints} / {data.graduationPoints}
                </span>
              </div>
              <ProgressBar value={data.completedPoints} max={data.graduationPoints} tone="primary" />
            </div>

            {/* 전공 / 전공필수 / 채플 … */}
            {creditRequirements.length > 0 && (
              <div className="space-y-3">
                {creditRequirements.map((requirement) => (
                  <div key={`${requirement.category}-${requirement.name}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[12px] text-muted-foreground">
                        {requirement.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[11.5px] font-bold",
                          requirement.satisfied ? "text-success" : "text-warning",
                        )}
                      >
                        {requirement.completed} / {requirement.required}
                      </span>
                    </div>
                    <ProgressBar
                      value={requirement.completed}
                      max={requirement.required}
                      tone={requirement.satisfied ? "success" : "warning"}
                      className="h-1.5"
                    />
                  </div>
                ))}
              </div>
            )}

            {unmetFlags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {unmetFlags.map((requirement) => (
                  <Badge
                    key={`${requirement.category}-${requirement.name}`}
                    variant="destructive"
                  >
                    {requirement.name.includes("미이수")
                      ? requirement.name
                      : `${requirement.name} 미이수`}
                  </Badge>
                ))}
              </div>
            ) : creditRequirements.length === 0 ? (
              <EmptyState
                icon={<Award className="h-6 w-6" aria-hidden="true" />}
                title="모든 요건을 충족했습니다"
                description="현재 확인된 미충족 졸업 요건이 없어요."
              />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
