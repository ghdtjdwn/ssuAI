"use client";

import { Utensils } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useTodayMeal } from "@/hooks/useTodayMeal";
import { mealTypeLabel } from "@/lib/utils";

import { WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

export function TodayMealWidget() {
  const { data, error, isLoading, refetch } = useTodayMeal();
  const errorState = getErrorStateDetails(error);

  let body: React.ReactNode;
  if (isLoading) {
    body = <WidgetSkeleton lines={3} />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (data) {
    const first = data.meals[0];
    const others = Math.max(0, new Set(data.meals.map((m) => m.restaurant)).size - 1);
    if (!first) {
      body = (
        <WidgetEmpty
          title="오늘 등록된 메뉴가 없어요"
          sub={
            data.closures.length > 0
              ? `휴무: ${data.closures.map((c) => c.restaurant).join(", ")}`
              : undefined
          }
        />
      );
    } else {
      body = (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-bold text-foreground">
              {first.restaurant}
            </span>
            <span className="shrink-0 rounded-[6px] bg-warning-bg px-1.5 py-0.5 text-[10.5px] font-bold text-warning">
              {first.corner || mealTypeLabel(first.type)}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {first.menu.length > 0 ? first.menu.join(", ") : "메뉴 준비 중"}
          </p>
          {others > 0 || data.closures.length > 0 ? (
            <p className="mt-2 text-[11px] text-subtle">
              {others > 0 ? `그 외 ${others}곳 운영 중` : null}
              {others > 0 && data.closures.length > 0 ? " · " : null}
              {data.closures.length > 0 ? `휴무 ${data.closures.length}곳` : null}
            </p>
          ) : null}
        </div>
      );
    }
  } else {
    body = <WidgetSkeleton lines={3} />;
  }

  return (
    <WidgetFrame icon={Utensils} title="오늘 학식">
      {body}
    </WidgetFrame>
  );
}
