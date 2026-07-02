"use client";

import { Award } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintGraduation } from "@/hooks/useSaintGraduation";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";

import { findMajorRequirement } from "../home-utils";
import { WidgetConnect, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

export function GraduationWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintGraduation(accessToken);
  const errorState = getErrorStateDetails(error);
  useSaintSessionGuard(errorState?.code);

  let body: React.ReactNode;
  let headerRight: React.ReactNode;
  if (authLoading || (isAuthenticated && isLoading)) {
    body = <WidgetSkeleton lines={3} />;
  } else if (!isAuthenticated) {
    body = <WidgetConnect provider="saint" />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (data) {
    headerRight = data.isGraduatable ? (
      <Badge variant="success">충족</Badge>
    ) : (
      <Badge variant="destructive">미충족</Badge>
    );
    const major = findMajorRequirement(data);
    const unsatisfied = data.requirements.filter((r) => !r.satisfied).slice(0, 2);
    body = (
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">총 취득학점</span>
          <span className="font-mono text-[12px] font-bold text-primary">
            {data.completedPoints}/{data.graduationPoints}
          </span>
        </div>
        <ProgressBar
          value={data.completedPoints}
          max={data.graduationPoints}
          tone="primary"
          className="h-[7px]"
        />
        {major ? (
          <>
            <div className="mb-1.5 mt-3 flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">{major.name}</span>
              <span className="font-mono text-[12px] font-bold text-foreground">
                {major.completed}/{major.required}
              </span>
            </div>
            <ProgressBar
              value={major.completed}
              max={major.required}
              tone={major.satisfied ? "success" : "warning"}
              className="h-[7px]"
            />
          </>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {unsatisfied.length === 0 ? (
            <span className="rounded-[6px] bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success">
              모든 요건 충족
            </span>
          ) : (
            unsatisfied.map((r) => (
              <span
                key={r.name}
                className="rounded-[6px] bg-warning-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold text-warning"
              >
                {r.name} {r.completed}/{r.required}
              </span>
            ))
          )}
        </div>
      </div>
    );
  } else {
    body = <WidgetSkeleton lines={3} />;
  }

  return (
    <WidgetFrame icon={Award} title="졸업 요건" headerRight={headerRight}>
      {body}
    </WidgetFrame>
  );
}
