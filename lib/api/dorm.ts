import { fetchPublicJson } from "./client";
import type { WeeklyMealResponse } from "./types";

export function getDormThisWeekMeal() {
  return fetchPublicJson<WeeklyMealResponse>("/api/dorm/meals/this-week");
}
