"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

import type { HomeLayoutController } from "./useHomeLayout";
import { WIDGET_MAP, type HomeWidgetDef } from "./widgets/registry";

interface WidgetGridProps {
  controller: HomeLayoutController;
  onOpenEditor: () => void;
}

/** "오늘 요약" header + customizable widget grid (desktop 3-col, mobile 1-col). */
export function WidgetGrid({ controller, onOpenEditor }: WidgetGridProps) {
  const { layout, visibleCount } = controller;
  const visible = layout.order
    .map((id) => WIDGET_MAP.get(id))
    .filter((def): def is HomeWidgetDef => !!def && layout.on[def.id]);

  return (
    <section className="mt-7">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold tracking-[-0.01em] text-foreground">
          오늘 요약
        </h2>
        <button
          type="button"
          onClick={onOpenEditor}
          className="press inline-flex h-8 items-center gap-1.5 rounded-pill border border-primary-100 bg-primary-soft px-3 text-[12px] font-bold text-primary-soft-foreground dark:border-primary-700"
        >
          <SlidersHorizontal size={15} aria-hidden />
          {visibleCount}개 표시 · 편집
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-8 text-center">
          <p className="text-[13.5px] font-semibold text-muted-foreground">
            표시 중인 위젯이 없어요
          </p>
          <button
            type="button"
            onClick={onOpenEditor}
            className="press mt-2 text-[12.5px] font-bold text-primary"
          >
            편집에서 위젯 켜기
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-3",
            layout.density === "compact"
              ? "gap-2.5 [&_[data-widget-frame]]:p-3"
              : "gap-3.5",
          )}
        >
          {visible.map((def) => {
            const Widget = def.component;
            return (
              <div
                key={def.id}
                className={cn(
                  "min-w-0 animate-fadeUp",
                  layout.span[def.id] === 2 && "lg:col-span-2",
                )}
              >
                <Widget />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
