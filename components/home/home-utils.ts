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

/**
 * A gentle, actionable "what to do today" suggestion for the briefing hero.
 * Pure and rule-based (no LLM): picks the single highest-priority action from
 * the connected data and phrases it as a suggestion, so unconnected sources are
 * simply absent rather than faked. Returns null for anonymous visitors (the
 * hero already shows a connect prompt for them).
 *
 * Priority: an imminent deadline (≤2 days) → a this-week deadline → remaining
 * chapel → a quiet-hours study nudge when a seat is free → a calm default.
 */
export interface TodaySuggestionInput {
  /** Nearest unsubmitted deadline, if any (soonest first). */
  nearestDeadline: { title: string; dday: number } | null;
  /** Chapel sessions still required, if the graduation data is loaded. */
  chapelRemaining: number | null;
  /** The library zone with the most free seats right now, if loaded. */
  bestSeat: { label: string; available: number } | null;
  isAuthenticated: boolean;
}

export function todaySuggestion(input: TodaySuggestionInput): string | null {
  const { nearestDeadline, chapelRemaining, bestSeat, isAuthenticated } = input;
  if (!isAuthenticated) return null;

  const seatHint =
    bestSeat && bestSeat.available > 0
      ? ` ${bestSeat.label}에 여유 좌석이 ${bestSeat.available}석 있어 집중하기 좋아요.`
      : "";

  if (nearestDeadline && nearestDeadline.dday <= 2) {
    const when = nearestDeadline.dday === 0 ? "오늘 마감" : `${dDayLabel(nearestDeadline.dday)} 마감`;
    return `오늘은 ${when}인 「${nearestDeadline.title}」부터 끝내보는 건 어때요?${seatHint}`;
  }
  if (nearestDeadline && nearestDeadline.dday <= 7) {
    return `이번 주 「${nearestDeadline.title}」 마감(${dDayLabel(nearestDeadline.dday)})이 다가와요. 오늘 조금씩 시작해두면 편해요.${seatHint}`;
  }
  if (chapelRemaining !== null && chapelRemaining > 0) {
    return `급한 과제 마감은 없어요. 채플이 ${chapelRemaining}회 남았으니 이번 주 채플 일정을 챙겨보는 건 어때요?`;
  }
  if (bestSeat && bestSeat.available > 0) {
    return `급한 마감은 없는 하루예요. ${bestSeat.label} 여유 좌석에서 밀린 복습을 몰아서 해보는 건 어때요?`;
  }
  return "급한 일정은 없어요. 오늘은 다음 주 수업·과제를 미리 훑어두면 한결 가벼워질 거예요.";
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
