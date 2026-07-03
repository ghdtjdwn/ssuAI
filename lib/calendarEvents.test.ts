import { describe, expect, it } from "vitest";

import type { AcademicCalendarEvent } from "@/lib/api/calendar";
import { isOngoing, pickRelevantEvents } from "@/lib/calendarEvents";

const TODAY = "2026-07-03";

function event(date: string, endDate: string | null = null): AcademicCalendarEvent {
  return { date, endDate, event: `event-${date}`, category: "" };
}

describe("pickRelevantEvents", () => {
  it("keeps an ongoing multi-day event whose start date is already past", () => {
    const events = [event("2026-06-29", "2026-07-10"), event("2026-08-01")];

    const picked = pickRelevantEvents(events, 3, TODAY);

    expect(picked.map((e) => e.date)).toEqual(["2026-06-29", "2026-08-01"]);
  });

  it("drops single-day events strictly before today", () => {
    const events = [event("2026-07-01"), event("2026-07-03"), event("2026-07-05")];

    const picked = pickRelevantEvents(events, 3, TODAY);

    expect(picked.map((e) => e.date)).toEqual(["2026-07-03", "2026-07-05"]);
  });

  it("drops a range that ended yesterday", () => {
    const events = [event("2026-06-20", "2026-07-02"), event("2026-07-04")];

    const picked = pickRelevantEvents(events, 3, TODAY);

    expect(picked.map((e) => e.date)).toEqual(["2026-07-04"]);
  });

  it("tolerates events without the endDate field (older backend)", () => {
    const legacy = { date: "2026-07-04", event: "legacy", category: "" };

    const picked = pickRelevantEvents([legacy], 3, TODAY);

    expect(picked).toHaveLength(1);
  });

  it("falls back to the latest past events when everything is over", () => {
    const events = [event("2026-01-05"), event("2026-02-01"), event("2026-03-01")];

    const picked = pickRelevantEvents(events, 2, TODAY);

    expect(picked.map((e) => e.date)).toEqual(["2026-02-01", "2026-03-01"]);
  });
});

describe("isOngoing", () => {
  it("is true inside a range, false after it ends", () => {
    expect(isOngoing(event("2026-06-29", "2026-07-10"), TODAY)).toBe(true);
    expect(isOngoing(event("2026-06-20", "2026-07-02"), TODAY)).toBe(false);
  });

  it("treats a single-day event as ongoing only on its own day", () => {
    expect(isOngoing(event("2026-07-03"), TODAY)).toBe(true);
    expect(isOngoing(event("2026-07-04"), TODAY)).toBe(false);
  });
});
