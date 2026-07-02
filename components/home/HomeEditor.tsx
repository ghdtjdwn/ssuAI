"use client";

import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import type { HomeDensity, HomeLayoutController } from "./useHomeLayout";
import { WIDGET_MAP, WIDGET_SECTIONS, type HomeWidgetDef } from "./widgets/registry";

/** Small on/off switch (no shadcn switch primitive in this repo). */
function HomeSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-pill transition-colors duration-200",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-e1 transition-transform duration-200 ease-spring",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

function ArrowButton({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: "up" | "down";
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="press flex h-4 w-[22px] items-center justify-center rounded-[5px] bg-muted text-subtle hover:text-foreground disabled:opacity-35 disabled:hover:text-subtle"
    >
      <Icon size={13} aria-hidden />
    </button>
  );
}

function EditorRow({
  def,
  controller,
  isFirst,
  isLast,
}: {
  def: HomeWidgetDef;
  controller: HomeLayoutController;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { layout, toggleWidget, cycleSpan, moveWidget } = controller;
  const on = !!layout.on[def.id];
  const span = layout.span[def.id] ?? def.defaultSpan;
  const Icon = def.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-[12px] border border-hairline bg-background px-2.5 py-2 transition-opacity duration-200",
        !on && "opacity-55",
      )}
    >
      <div className="flex flex-col gap-0.5">
        <ArrowButton
          direction="up"
          disabled={isFirst}
          onClick={() => moveWidget(def.id, -1)}
          label={`${def.title} 위로 이동`}
        />
        <ArrowButton
          direction="down"
          disabled={isLast}
          onClick={() => moveWidget(def.id, 1)}
          label={`${def.title} 아래로 이동`}
        />
      </div>
      <Icon size={18} className="shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{def.title}</p>
        <span className="mt-0.5 inline-flex rounded-[5px] bg-muted px-1.5 py-px text-[10px] font-bold text-subtle">
          {def.section}
        </span>
      </div>
      <button
        type="button"
        onClick={() => cycleSpan(def.id)}
        aria-label={`${def.title} 크기 전환`}
        className="press hidden h-[26px] items-center rounded-[8px] border border-border bg-surface px-2 text-[11px] font-bold text-muted-foreground lg:inline-flex"
      >
        {span === 2 ? "2칸" : "1칸"}
      </button>
      <HomeSwitch checked={on} onChange={() => toggleWidget(def.id)} label={`${def.title} 표시`} />
    </div>
  );
}

interface HomeEditorProps {
  open: boolean;
  onClose: () => void;
  controller: HomeLayoutController;
}

/**
 * Home customization panel — bottom sheet on mobile, right slide-over on
 * desktop (Sheet side="responsive"). Rows are grouped by widget section;
 * ↑/↓ reorders within the section.
 */
export function HomeEditor({ open, onClose, controller }: HomeEditorProps) {
  const { toast } = useToast();
  const { layout, toggleBriefing, setDensity, reset } = controller;

  return (
    <Sheet open={open} onClose={onClose} title="홈 편집" side="responsive">
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-[12px] text-subtle">위젯 표시 · 순서 · 크기를 바꿔요</p>
          <div className="mt-4 flex flex-col gap-5">
            {WIDGET_SECTIONS.map((section) => {
              const ids = layout.order.filter(
                (id) => WIDGET_MAP.get(id)?.section === section,
              );
              if (ids.length === 0) return null;
              return (
                <section key={section}>
                  <h3 className="mb-2 text-[11px] font-bold tracking-[0.06em] text-subtle">
                    {section}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {ids.map((id, index) => {
                      const def = WIDGET_MAP.get(id);
                      if (!def) return null;
                      return (
                        <EditorRow
                          key={id}
                          def={def}
                          controller={controller}
                          isFirst={index === 0}
                          isLast={index === ids.length - 1}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.06em] text-subtle">화면</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 rounded-[12px] border border-hairline px-3 py-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">AI 오늘의 브리핑</p>
                <p className="text-[11px] text-subtle">상단 히어로 카드</p>
              </div>
              <HomeSwitch
                checked={layout.briefingOn}
                onChange={toggleBriefing}
                label="AI 오늘의 브리핑 표시"
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-[12px] border border-hairline px-3 py-3">
              <p className="text-[13px] font-semibold text-foreground">밀도</p>
              <Segmented<HomeDensity>
                size="sm"
                value={layout.density}
                onChange={setDensity}
                options={[
                  { value: "comfortable", label: "넉넉" },
                  { value: "compact", label: "촘촘" },
                ]}
              />
            </div>
          </div>
        </section>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            reset();
            toast("info", "홈을 기본값으로 되돌렸어요");
          }}
        >
          <RotateCcw size={15} aria-hidden />
          기본값으로 초기화
        </Button>
      </div>
    </Sheet>
  );
}
