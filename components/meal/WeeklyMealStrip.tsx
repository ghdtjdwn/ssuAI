"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Utensils } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import type { MealResponse } from "@/lib/api/types";
import { cn, formatShortKoreanDate, getSeoulDateString, mealTypeLabel } from "@/lib/utils";

const mealTypeOrder = new Map([
  ["ALL_DAY", 0],
  ["BREAKFAST", 1],
  ["LUNCH", 2],
  ["DINNER", 3],
]);

interface WeeklyMealStripProps {
  days: MealResponse[];
  emptyTitle: string;
  emptyDescription: string;
}

function sortMeals(day: MealResponse) {
  return [...day.meals].sort(
    (left, right) => (mealTypeOrder.get(left.type) ?? 99) - (mealTypeOrder.get(right.type) ?? 99),
  );
}

export function WeeklyMealStrip({ days, emptyTitle, emptyDescription }: WeeklyMealStripProps) {
  const today = getSeoulDateString();
  const defaultDate = useMemo(
    () => days.find((day) => day.date === today)?.date ?? days[0]?.date ?? "",
    [days, today],
  );
  const [selectedDate, setSelectedDate] = useState("");
  const selectedDateExists = days.some((day) => day.date === selectedDate);
  const activeDate = selectedDateExists ? selectedDate : defaultDate;
  const selectedDay = days.find((day) => day.date === activeDate);
  const selectedMeals = selectedDay ? sortMeals(selectedDay) : [];

  if (days.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {days.map((day) => {
          const active = day.date === selectedDay?.date;
          const sortedMeals = sortMeals(day);
          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedDate(day.date)}
              className={cn(
                "press flex min-h-[76px] flex-col items-start gap-1.5 rounded-[12px] border p-2.5 text-left transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground shadow-e2"
                  : "border-hairline bg-surface hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "font-mono text-[12px] font-bold",
                  active ? "text-primary-foreground" : "text-foreground",
                )}
              >
                {formatShortKoreanDate(day.date)}
              </span>
              <span className="flex flex-wrap gap-1">
                {sortedMeals.length > 0 ? (
                  sortedMeals.map((meal) => (
                    <span
                      key={`${day.date}-${meal.restaurant}-${meal.type}-${meal.corner}`}
                      className={cn(
                        "rounded-pill px-1.5 py-0.5 text-[10px] font-bold",
                        active
                          ? "bg-white/15 text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {mealTypeLabel(meal.type)}
                    </span>
                  ))
                ) : (
                  <span
                    className={cn(
                      "text-[10.5px]",
                      active ? "text-primary-foreground/80" : "text-subtle",
                    )}
                  >
                    메뉴 없음
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selectedDay && selectedMeals.length > 0 ? (
        <div className="rounded-[12px] border border-hairline bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h4 className="font-mono text-[13px] font-bold text-foreground">
              {formatShortKoreanDate(selectedDay.date)}
            </h4>
            {selectedDay.closures.map((closure) => (
              <Badge key={`${closure.restaurant}-${closure.reason}`} variant="warning">
                휴무: {closure.restaurant} · {closure.reason}
              </Badge>
            ))}
          </div>
          <div className="space-y-3.5">
            {selectedMeals.map((meal) => (
              <section key={`${meal.restaurant}-${meal.type}-${meal.corner}`} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>{mealTypeLabel(meal.type)}</Badge>
                  <span className="text-[13px] font-bold text-foreground">{meal.restaurant}</span>
                  {meal.corner ? <Badge variant="mint">{meal.corner}</Badge> : null}
                </div>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  {meal.menu.length > 0 ? meal.menu.join(", ") : "메뉴 준비 중"}
                </p>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Utensils className="h-6 w-6" aria-hidden="true" />}
          title="선택한 날짜의 메뉴가 없습니다"
          description="다른 날짜를 선택해보세요."
        />
      )}
    </div>
  );
}
