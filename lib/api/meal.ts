import { fetchPublicJson } from "./client";
import type { MealResponse, WeeklyMealResponse } from "./types";

export function getTodayMeal() {
  return fetchPublicJson<MealResponse>("/api/meals/today");
}

export function getWeeklyMeals(startDate?: string) {
  const params = new URLSearchParams();

  if (startDate) {
    params.set("startDate", startDate);
  }

  const query = params.toString();
  return fetchPublicJson<WeeklyMealResponse>(`/api/meals/weekly${query ? `?${query}` : ""}`);
}
