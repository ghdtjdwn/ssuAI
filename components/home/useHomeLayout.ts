"use client";

import { useCallback, useSyncExternalStore } from "react";

import { WIDGET_MAP, WIDGET_REGISTRY } from "./widgets/registry";

export const HOME_LAYOUT_STORAGE_KEY = "ssuai:home-layout:v1";

export type HomeDensity = "comfortable" | "compact";

export interface HomeLayout {
  order: string[];
  on: Record<string, boolean>;
  span: Record<string, 1 | 2>;
  briefingOn: boolean;
  density: HomeDensity;
}

export function defaultHomeLayout(): HomeLayout {
  const on: Record<string, boolean> = {};
  const span: Record<string, 1 | 2> = {};
  for (const def of WIDGET_REGISTRY) {
    on[def.id] = def.defaultOn;
    span[def.id] = def.defaultSpan;
  }
  return {
    order: WIDGET_REGISTRY.map((def) => def.id),
    on,
    span,
    briefingOn: true,
    density: "comfortable",
  };
}

/**
 * Validate persisted layout against the registry: drop unknown widget ids,
 * append newly shipped ones (registry order), coerce bad field values back
 * to defaults. Never throws.
 */
export function normalizeHomeLayout(raw: unknown): HomeLayout {
  const fallback = defaultHomeLayout();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const input = raw as Record<string, unknown>;

  const rawOrder = Array.isArray(input.order)
    ? input.order.filter((id): id is string => typeof id === "string")
    : [];
  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of rawOrder) {
    if (WIDGET_MAP.has(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of fallback.order) {
    if (!seen.has(id)) order.push(id);
  }

  const rawOn =
    input.on && typeof input.on === "object" ? (input.on as Record<string, unknown>) : {};
  const rawSpan =
    input.span && typeof input.span === "object" ? (input.span as Record<string, unknown>) : {};
  const on: Record<string, boolean> = {};
  const span: Record<string, 1 | 2> = {};
  for (const def of WIDGET_REGISTRY) {
    on[def.id] = typeof rawOn[def.id] === "boolean" ? (rawOn[def.id] as boolean) : def.defaultOn;
    span[def.id] = rawSpan[def.id] === 2 ? 2 : rawSpan[def.id] === 1 ? 1 : def.defaultSpan;
  }

  return {
    order,
    on,
    span,
    briefingOn: typeof input.briefingOn === "boolean" ? input.briefingOn : true,
    density: input.density === "compact" ? "compact" : "comfortable",
  };
}

// --- localStorage-backed external store -------------------------------------
// useSyncExternalStore keeps this SSR-safe without setState-in-effect: the
// server snapshot renders the default layout, the client snapshot reads
// localStorage, and React reconciles after hydration without mismatches.

const SERVER_LAYOUT = defaultHomeLayout();

const listeners = new Set<() => void>();

/** Memoized parse so getSnapshot returns a referentially stable object. */
let cache: { raw: string | null; layout: HomeLayout } | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(HOME_LAYOUT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseLayout(raw: string | null): HomeLayout {
  if (!raw) return defaultHomeLayout();
  try {
    return normalizeHomeLayout(JSON.parse(raw));
  } catch {
    return defaultHomeLayout();
  }
}

function getSnapshot(): HomeLayout {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) {
    cache = { raw, layout: parseLayout(raw) };
  }
  return cache.layout;
}

function getServerSnapshot(): HomeLayout {
  return SERVER_LAYOUT;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Cross-tab updates. Same-tab writes notify through writeLayout().
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function writeLayout(next: HomeLayout) {
  let raw: string | null = JSON.stringify(next);
  try {
    window.localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, raw);
  } catch {
    // Storage blocked/full: keep the in-memory layout for this session.
    raw = readRaw();
  }
  cache = { raw, layout: next };
  listeners.forEach((listener) => listener());
}

function updateLayout(mutate: (current: HomeLayout) => HomeLayout) {
  writeLayout(mutate(getSnapshot()));
}

const emptySubscribe = () => () => {};

// -----------------------------------------------------------------------------

export interface HomeLayoutController {
  layout: HomeLayout;
  /** False during SSR/hydration render; true once the client store is live. */
  hydrated: boolean;
  visibleCount: number;
  toggleWidget: (id: string) => void;
  cycleSpan: (id: string) => void;
  /** Moves a widget up/down among its own section's members in the global order. */
  moveWidget: (id: string, dir: -1 | 1) => void;
  toggleBriefing: () => void;
  setDensity: (density: HomeDensity) => void;
  reset: () => void;
}

/**
 * Home customization state persisted to localStorage
 * (`ssuai:home-layout:v1`), validated against the widget registry on load.
 */
export function useHomeLayout(): HomeLayoutController {
  const layout = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const toggleWidget = useCallback((id: string) => {
    updateLayout((s) => ({ ...s, on: { ...s.on, [id]: !s.on[id] } }));
  }, []);

  const cycleSpan = useCallback((id: string) => {
    updateLayout((s) => ({
      ...s,
      span: { ...s.span, [id]: s.span[id] === 2 ? 1 : 2 },
    }));
  }, []);

  const moveWidget = useCallback((id: string, dir: -1 | 1) => {
    updateLayout((s) => {
      const def = WIDGET_MAP.get(id);
      if (!def) return s;
      const sectionIds = s.order.filter((wid) => WIDGET_MAP.get(wid)?.section === def.section);
      const pos = sectionIds.indexOf(id);
      const neighbor = sectionIds[pos + dir];
      if (pos < 0 || !neighbor) return s;
      const order = [...s.order];
      const i = order.indexOf(id);
      const j = order.indexOf(neighbor);
      order[i] = neighbor;
      order[j] = id;
      return { ...s, order };
    });
  }, []);

  const toggleBriefing = useCallback(() => {
    updateLayout((s) => ({ ...s, briefingOn: !s.briefingOn }));
  }, []);

  const setDensity = useCallback((density: HomeDensity) => {
    updateLayout((s) => ({ ...s, density }));
  }, []);

  const reset = useCallback(() => {
    writeLayout(defaultHomeLayout());
  }, []);

  const visibleCount = layout.order.filter((id) => layout.on[id]).length;

  return {
    layout,
    hydrated,
    visibleCount,
    toggleWidget,
    cycleSpan,
    moveWidget,
    toggleBriefing,
    setDensity,
    reset,
  };
}
