"use client";

import { Star } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintGrades } from "@/hooks/useSaintGrades";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";

import { WidgetConnect, WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

export function GpaWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const { data, error, isLoading, refetch } = useSaintGrades(accessToken);
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
    const record = data.academicRecord;
    if (!record) {
      body = <WidgetEmpty title="성적 정보가 없어요" />;
    } else {
      body = (
        <div>
          <div className="font-mono text-[30px] font-bold leading-none text-primary">
            {record.gpa.toFixed(2)}
            <span className="text-[14px] text-subtle">/4.5</span>
          </div>
          <p className="mt-1.5 text-[12px] text-subtle">취득 {record.earnedCredits}학점</p>
        </div>
      );
    }
  } else {
    body = <WidgetSkeleton lines={2} />;
  }

  return (
    <WidgetFrame icon={Star} title="누적 성적">
      {body}
    </WidgetFrame>
  );
}
