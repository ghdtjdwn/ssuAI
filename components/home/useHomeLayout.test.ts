import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  HOME_LAYOUT_STORAGE_KEY,
  defaultHomeLayout,
  normalizeHomeLayout,
  useHomeLayout,
} from "./useHomeLayout";
import { WIDGET_REGISTRY } from "./widgets/registry";

const ALL_IDS = WIDGET_REGISTRY.map((def) => def.id);

function readStored() {
  const raw = window.localStorage.getItem(HOME_LAYOUT_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("useHomeLayout — default layout", () => {
  it("starts with the registry defaults", () => {
    const { result } = renderHook(() => useHomeLayout());
    const { layout } = result.current;

    expect(layout.order).toEqual(ALL_IDS);
    expect(layout.briefingOn).toBe(true);
    expect(layout.density).toBe("comfortable");
    for (const def of WIDGET_REGISTRY) {
      expect(layout.on[def.id]).toBe(def.defaultOn);
      expect(layout.span[def.id]).toBe(def.defaultSpan);
    }
    // Default ON = the six 오늘-section widgets.
    expect(result.current.visibleCount).toBe(6);
    expect(result.current.hydrated).toBe(true);
  });
});

describe("useHomeLayout — persistence roundtrip", () => {
  it("persists toggles to localStorage and restores them in a fresh hook", () => {
    const first = renderHook(() => useHomeLayout());
    act(() => {
      first.result.current.toggleWidget("timetable"); // off -> on
      first.result.current.toggleWidget("meal"); // on -> off
      first.result.current.toggleBriefing(); // true -> false
      first.result.current.setDensity("compact");
      first.result.current.cycleSpan("seats"); // 2 -> 1
    });

    const stored = readStored();
    expect(stored.on.timetable).toBe(true);
    expect(stored.on.meal).toBe(false);
    expect(stored.briefingOn).toBe(false);
    expect(stored.density).toBe("compact");
    expect(stored.span.seats).toBe(1);

    first.unmount();

    const second = renderHook(() => useHomeLayout());
    expect(second.result.current.layout.on.timetable).toBe(true);
    expect(second.result.current.layout.on.meal).toBe(false);
    expect(second.result.current.layout.briefingOn).toBe(false);
    expect(second.result.current.layout.density).toBe("compact");
    expect(second.result.current.layout.span.seats).toBe(1);
  });

  it("persists section-scoped reordering", () => {
    const first = renderHook(() => useHomeLayout());
    act(() => {
      first.result.current.moveWidget("deadline", -1); // swap with "schedule"
    });
    expect(first.result.current.layout.order.slice(0, 2)).toEqual(["deadline", "schedule"]);

    first.unmount();
    const second = renderHook(() => useHomeLayout());
    expect(second.result.current.layout.order.slice(0, 2)).toEqual(["deadline", "schedule"]);
  });

  it("does not move a widget past its section boundary", () => {
    const { result } = renderHook(() => useHomeLayout());
    act(() => {
      result.current.moveWidget("schedule", -1); // first of 오늘
      result.current.moveWidget("timetable", -1); // first of 학사
    });
    expect(result.current.layout.order).toEqual(ALL_IDS);
  });

  it("reset restores defaults and persists them", () => {
    const { result } = renderHook(() => useHomeLayout());
    act(() => {
      result.current.toggleWidget("gpa");
      result.current.setDensity("compact");
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.layout).toEqual(defaultHomeLayout());
    expect(readStored()).toEqual(defaultHomeLayout());
  });
});

describe("useHomeLayout — unknown-id pruning", () => {
  it("drops unknown ids and appends missing registry ids on load", () => {
    window.localStorage.setItem(
      HOME_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        order: ["ghost-widget", "meal", "gpa"],
        on: { "ghost-widget": true, meal: false },
        span: { "ghost-widget": 2, meal: 2 },
        briefingOn: false,
        density: "compact",
      }),
    );

    const { result } = renderHook(() => useHomeLayout());
    const { layout } = result.current;

    expect(layout.order).not.toContain("ghost-widget");
    expect(layout.order.slice(0, 2)).toEqual(["meal", "gpa"]);
    // every registry id present exactly once
    expect([...layout.order].sort()).toEqual([...ALL_IDS].sort());
    expect(layout.on["ghost-widget"]).toBeUndefined();
    expect(layout.on.meal).toBe(false);
    expect(layout.span.meal).toBe(2);
    expect(layout.briefingOn).toBe(false);
    expect(layout.density).toBe("compact");
  });

  it("falls back to defaults for corrupted storage", () => {
    window.localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, "{not json");
    const { result } = renderHook(() => useHomeLayout());
    expect(result.current.layout).toEqual(defaultHomeLayout());
  });
});

describe("normalizeHomeLayout", () => {
  it("returns defaults for non-object input", () => {
    expect(normalizeHomeLayout(null)).toEqual(defaultHomeLayout());
    expect(normalizeHomeLayout("x")).toEqual(defaultHomeLayout());
    expect(normalizeHomeLayout([1, 2])).toEqual(defaultHomeLayout());
  });

  it("coerces invalid field values back to defaults", () => {
    const layout = normalizeHomeLayout({
      order: ["meal", "meal", 42],
      on: { meal: "yes" },
      span: { meal: 3 },
      briefingOn: "no",
      density: "cozy",
    });
    expect(layout.order.filter((id) => id === "meal")).toHaveLength(1);
    expect(layout.on.meal).toBe(true); // defaultOn
    expect(layout.span.meal).toBe(1); // defaultSpan
    expect(layout.briefingOn).toBe(true);
    expect(layout.density).toBe("comfortable");
  });
});
