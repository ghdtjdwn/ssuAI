import { describe, expect, it } from "vitest";

import { todaySuggestion } from "./home-utils";

const BASE = {
  nearestDeadline: null,
  chapelRemaining: null,
  bestSeat: null,
  isAuthenticated: true,
} as const;

describe("todaySuggestion", () => {
  it("returns null for anonymous visitors", () => {
    expect(todaySuggestion({ ...BASE, isAuthenticated: false })).toBeNull();
  });

  it("prioritizes an imminent deadline (≤2 days) and names it", () => {
    const s = todaySuggestion({
      ...BASE,
      nearestDeadline: { title: "운영체제 과제 3", dday: 1 },
      chapelRemaining: 4,
    });
    expect(s).toContain("운영체제 과제 3");
    expect(s).toContain("D-1 마감");
    expect(s).toContain("어때요?");
  });

  it("says 오늘 마감 for a same-day deadline", () => {
    const s = todaySuggestion({ ...BASE, nearestDeadline: { title: "퀴즈", dday: 0 } });
    expect(s).toContain("오늘 마감");
    expect(s).not.toContain("D-0");
  });

  it("weaves in a free seat when one is available", () => {
    const s = todaySuggestion({
      ...BASE,
      nearestDeadline: { title: "리포트", dday: 0 },
      bestSeat: { label: "5층 열람실", available: 42 },
    });
    expect(s).toContain("5층 열람실");
    expect(s).toContain("42석");
  });

  it("falls back to a this-week deadline nudge for dday 3-7", () => {
    const s = todaySuggestion({ ...BASE, nearestDeadline: { title: "발표 자료", dday: 5 } });
    expect(s).toContain("이번 주");
    expect(s).toContain("발표 자료");
    expect(s).toContain("D-5");
  });

  it("suggests chapel when no near deadline but chapel remains", () => {
    const s = todaySuggestion({ ...BASE, chapelRemaining: 3 });
    expect(s).toContain("채플이 3회");
  });

  it("nudges a study session when only a free seat is present", () => {
    const s = todaySuggestion({ ...BASE, bestSeat: { label: "2층 오픈", available: 10 } });
    expect(s).toContain("2층 오픈");
    expect(s).toContain("복습");
  });

  it("gives a calm default when nothing is pressing", () => {
    const s = todaySuggestion({ ...BASE, chapelRemaining: 0 });
    expect(s).toContain("급한 일정은 없어요");
  });
});
