import type { GraduationRequirementItem, GraduationStatus } from "@/lib/api/types";
import { getSeoulDateString } from "@/lib/utils";

/** Calendar-day difference (Seoul) from today to the given date. Positive = future. */
export function daysUntil(dateInput: string, now = new Date()): number | null {
  const target = new Date(dateInput);
  if (Number.isNaN(target.getTime())) return null;
  const t0 = Date.parse(`${getSeoulDateString(now)}T00:00:00Z`);
  const t1 = Date.parse(`${getSeoulDateString(target)}T00:00:00Z`);
  return Math.round((t1 - t0) / 86_400_000);
}

export function dDayLabel(days: number): string {
  if (days === 0) return "D-DAY";
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

/** "MM.DD" for compact due-date display. */
export function formatMonthDay(dateInput: string): string | null {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  const [, month, day] = getSeoulDateString(d).split("-");
  return `${month}.${day}`;
}

export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "좋은 아침이에요";
  if (hour >= 12 && hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

/** Current time "HH:MM" in Seoul (lexicographically comparable). */
export function seoulTimeHM(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

/** ISO weekday (Mon=1 … Sun=7) of today in Seoul; matches ScheduleEntry.dayOfWeek. */
export function seoulIsoWeekday(now = new Date()): number {
  const day = new Date(`${getSeoulDateString(now)}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** First "HH:MM" found in a schedule timeRange string. */
export function parseStartTime(timeRange: string): string | null {
  const m = timeRange.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function findRequirement(
  data: GraduationStatus | undefined,
  keyword: string,
): GraduationRequirementItem | undefined {
  return data?.requirements.find(
    (r) => r.name.includes(keyword) || r.category.includes(keyword),
  );
}

/**
 * Overall major(전공) requirement. Several 전공* items may exist
 * (전공필수/전공선택 …); the one with the largest required credits is the
 * umbrella requirement the hero chip should show.
 */
export function findMajorRequirement(
  data: GraduationStatus | undefined,
): GraduationRequirementItem | undefined {
  const candidates = data?.requirements.filter(
    (r) => r.name.includes("전공") || r.category.includes("전공"),
  );
  if (!candidates || candidates.length === 0) return undefined;
  return candidates.reduce((best, r) => (r.required > best.required ? r : best));
}

export type SeatTone = "success" | "warning" | "danger";

/** Availability tone: >=40% free = success, >=15% = warning, else danger. */
export function seatTone(available: number, total: number): SeatTone {
  const ratio = total > 0 ? available / total : 0;
  if (ratio >= 0.4) return "success";
  if (ratio >= 0.15) return "warning";
  return "danger";
}

export const seatToneTextClass: Record<SeatTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};
