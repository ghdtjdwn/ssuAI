"use client";

import { UtensilsCrossed } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useDormWeeklyMeal } from "@/hooks/useDormWeeklyMeal";
import { getSeoulDateString, mealTypeLabel } from "@/lib/utils";

import { WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

export function DormMealWidget() {
  const { data, error, isLoading, refetch } = useDormWeeklyMeal();
  const errorState = getErrorStateDetails(error);

  let body: React.ReactNode;
  if (isLoading) {
    body = <WidgetSkeleton lines={2} />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (data) {
    const today = data.days.find((d) => d.date === getSeoulDateString());
    const meal = today?.meals[0];
    if (!meal) {
      body = <WidgetEmpty title="오늘 기숙사 식단 정보가 없어요" />;
    } else {
      body = (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-bold text-foreground">
              {meal.restaurant}
            </span>
            <span className="shrink-0 rounded-[5px] bg-mint-50 px-1.5 py-0.5 text-[10px] font-bold text-mint-700 dark:bg-mint-700/20 dark:text-mint-300">
              {mealTypeLabel(meal.type)}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {meal.menu.length > 0 ? meal.menu.join(", ") : "메뉴 준비 중"}
          </p>
        </div>
      );
    }
  } else {
    body = <WidgetSkeleton lines={2} />;
  }

  return (
    <WidgetFrame icon={UtensilsCrossed} title="기숙사 식단">
      {body}
    </WidgetFrame>
  );
}
