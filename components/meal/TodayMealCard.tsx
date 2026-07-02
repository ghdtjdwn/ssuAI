"use client";

import { useMemo } from "react";

import { Utensils } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTodayMeal } from "@/hooks/useTodayMeal";
import type { MealItem } from "@/lib/api/types";
import { formatKoreanDate, mealTypeLabel } from "@/lib/utils";

function groupByRestaurant(meals: MealItem[]) {
  return meals.reduce<Record<string, MealItem[]>>((groups, meal) => {
    (groups[meal.restaurant] ??= []).push(meal);
    return groups;
  }, {});
}

function TodayMealSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-24 w-full rounded-[12px]" />
      <Skeleton className="h-24 w-full rounded-[12px]" />
    </div>
  );
}

export function TodayMealCard() {
  const { data, error, isLoading, refetch } = useTodayMeal();
  const errorState = getErrorStateDetails(error);
  const groupedMeals = useMemo(() => data ? groupByRestaurant(data.meals) : {}, [data]);
  const hasMeals = data ? data.meals.length > 0 : false;
  const hasClosures = data ? data.closures.length > 0 : false;

  return (
    <Card className="h-full animate-fadeUp">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Utensils size={18} className="shrink-0 text-primary" aria-hidden="true" />
          <CardTitle>오늘의 학식</CardTitle>
        </div>
        <span className="shrink-0 font-mono text-[11.5px] text-subtle">
          {data ? formatKoreanDate(data.date) : "학생식당 메뉴"}
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? <TodayMealSkeleton /> : null}

        {errorState ? (
          <ErrorState
            code={errorState.code}
            message={errorState.message}
            traceId={errorState.traceId}
            onRetry={() => void refetch()}
          />
        ) : null}

        {data && !hasMeals && !hasClosures ? (
          <EmptyState
            icon={<Utensils className="h-6 w-6" aria-hidden="true" />}
            title="등록된 메뉴가 없습니다"
            description="오늘 공개된 학식 정보가 아직 없습니다."
          />
        ) : null}

        {data && (hasMeals || hasClosures) ? (
          <div className="space-y-3">
            {hasClosures ? (
              <div className="flex flex-wrap gap-1.5">
                {data.closures.map((closure) => (
                  <Badge key={`${closure.restaurant}-${closure.reason}`} variant="warning">
                    휴무: {closure.restaurant} · {closure.reason}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="space-y-2.5">
              {Object.entries(groupedMeals).map(([restaurant, meals]) => (
                <section
                  key={restaurant}
                  className="rounded-[12px] border border-hairline bg-surface p-3.5"
                >
                  <h4 className="text-[13.5px] font-bold text-foreground">{restaurant}</h4>
                  <div className="mt-2.5 space-y-3">
                    {meals.map((meal) => (
                      <div key={`${meal.restaurant}-${meal.type}-${meal.corner}`}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge>{mealTypeLabel(meal.type)}</Badge>
                          {meal.corner ? <Badge variant="mint">{meal.corner}</Badge> : null}
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                          {meal.menu.length > 0 ? meal.menu.join(", ") : "메뉴 준비 중"}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
