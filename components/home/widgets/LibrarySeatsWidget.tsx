"use client";

import { Armchair } from "lucide-react";

import { ProgressBar } from "@/components/ui/progress";

import { seatTone, seatToneTextClass } from "../home-utils";
import { useLibraryZones } from "../useLibraryZones";
import { WidgetConnect, WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

/** span-2 widget: mini availability bars for every library space. */
export function LibrarySeatsWidget() {
  const { zones, isLoading, needsAuth, error, refetchAll } = useLibraryZones();

  let body: React.ReactNode;
  if (needsAuth) {
    body = <WidgetConnect provider="library" />;
  } else if (isLoading) {
    body = <WidgetSkeleton lines={4} />;
  } else if (zones.length === 0 && error) {
    body = <WidgetError onRetry={refetchAll} />;
  } else if (zones.length === 0) {
    body = <WidgetEmpty title="좌석 정보가 없어요" />;
  } else {
    const tones = { success: "success", warning: "warning", danger: "danger" } as const;
    body = (
      <div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {zones.map((zone) => {
            const tone = seatTone(zone.available, zone.total);
            return (
              <div key={`${zone.floor}-${zone.label}`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-semibold text-foreground">
                    {zone.label}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-[11.5px] font-bold ${seatToneTextClass[tone]}`}
                  >
                    {zone.available}/{zone.total}
                  </span>
                </div>
                <ProgressBar
                  value={zone.available}
                  max={zone.total}
                  tone={tones[tone]}
                  className="h-[7px]"
                />
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-subtle">실시간 자동 갱신 · 30초</p>
      </div>
    );
  }

  return (
    <WidgetFrame icon={Armchair} title="도서관 좌석">
      {body}
    </WidgetFrame>
  );
}
