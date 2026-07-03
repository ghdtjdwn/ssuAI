import type { AcademicCalendarEvent } from "@/lib/api/calendar";

/** The date that decides whether an event is over: its inclusive end, else its start. */
function lastDay(event: AcademicCalendarEvent): string {
  return event.endDate ?? event.date;
}

/**
 * Events that are ongoing or upcoming as of `today`, soonest first; falls back
 * to the latest past events when everything is over. Range-aware: a multi-day
 * event that started yesterday but ends tomorrow is still relevant, so the
 * filter keys on the inclusive end date rather than the start.
 */
export function pickRelevantEvents(
  events: AcademicCalendarEvent[],
  limit: number,
  today: string,
): AcademicCalendarEvent[] {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const relevant = sorted.filter((e) => lastDay(e) >= today);
  return (relevant.length > 0 ? relevant : sorted.slice(-limit)).slice(0, limit);
}

/** True while `today` falls inside a multi-day event's [date, endDate] range. */
export function isOngoing(event: AcademicCalendarEvent, today: string): boolean {
  return event.date <= today && today <= lastDay(event);
}
