"use client";

import { Armchair, Church } from "lucide-react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { DonutGauge } from "@/components/ui/progress";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintChapel } from "@/hooks/useSaintChapel";
import { useSaintGraduation } from "@/hooks/useSaintGraduation";
import { useSaintSessionGuard } from "@/hooks/useSaintSessionGuard";

import { findRequirement } from "../home-utils";
import { WidgetConnect, WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

export function ChapelWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const chapelQ = useSaintChapel(accessToken);
  const gradQ = useSaintGraduation(accessToken);
  const chapelError = getErrorStateDetails(chapelQ.error);
  useSaintSessionGuard(chapelError?.code);

  const chapelReq = findRequirement(gradQ.data, "채플");
  const chapel = chapelQ.data;

  let body: React.ReactNode;
  if (authLoading || (isAuthenticated && (chapelQ.isLoading || gradQ.isLoading))) {
    body = <WidgetSkeleton lines={3} />;
  } else if (!isAuthenticated) {
    body = <WidgetConnect provider="saint" />;
  } else if (chapelError && !chapelReq) {
    body = <WidgetError onRetry={() => void chapelQ.refetch()} />;
  } else if (!chapelReq && !chapel) {
    body = <WidgetEmpty title="채플 정보가 없어요" />;
  } else {
    const seatLine =
      chapel?.seatNumber && chapel.chapelRoom
        ? `${chapel.chapelRoom} · ${chapel.seatNumber}`
        : chapel?.seatNumber || null;
    body = (
      <div className="flex flex-wrap items-center gap-3">
        {chapelReq ? (
          <>
            <DonutGauge
              value={chapelReq.completed}
              max={chapelReq.required}
              size={74}
              strokeWidth={8}
              tone="primary"
              label={
                <span className="font-mono text-[14px] font-bold text-primary">
                  {chapelReq.completed}/{chapelReq.required}
                </span>
              }
              subLabel="이수"
            />
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-foreground">
                {chapelReq.remaining > 0 ? `${chapelReq.remaining}회 남음` : "이수 완료"}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {chapelReq.remaining > 0
                  ? "남은 학기에 이수하면 졸업요건 충족"
                  : "졸업요건을 충족했어요"}
              </p>
            </div>
          </>
        ) : chapel ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13.5px] font-bold text-foreground">
                {chapel.year} {chapel.semester}
              </p>
              <Badge variant={chapel.result === "이수" ? "success" : "secondary"}>
                {chapel.result || "진행 중"}
              </Badge>
            </div>
            {chapel.chapelTime ? (
              <p className="mt-1 text-[12px] text-muted-foreground">{chapel.chapelTime}</p>
            ) : null}
          </div>
        ) : null}
        {seatLine ? (
          <div className="flex w-full items-center gap-2 rounded-control bg-primary-soft px-3 py-2">
            <Armchair size={16} className="shrink-0 text-primary-soft-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-[10.5px] text-subtle">지정 좌석</p>
              <p className="truncate text-[12px] font-bold text-primary-soft-foreground">
                {seatLine}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <WidgetFrame icon={Church} title="채플 진행도">
      {body}
    </WidgetFrame>
  );
}
