"use client";

import { CheckCircle, XCircle } from "lucide-react";

import type { InterruptData } from "@/lib/api/agent";
import { Button } from "@/components/ui/button";

interface HitlCardProps {
  interrupt: InterruptData;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

function formatDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return "";
  if (details.message) return String(details.message);
  const parts: string[] = [];
  if (details.seatCode) parts.push(`좌석 ${String(details.seatCode)}`);
  if (details.roomName) parts.push(String(details.roomName));
  if (details.actionType) parts.push(String(details.actionType));
  return parts.join(" · ");
}

export function HitlCard({ interrupt, onApprove, onReject, isProcessing }: HitlCardProps) {
  const summary = formatDetails(interrupt.details);

  return (
    <div className="my-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      <p className="font-semibold text-amber-900 dark:text-amber-100">
        도서관 예약 확인 요청
      </p>
      {summary ? (
        <p className="mt-1 text-amber-800 dark:text-amber-200">{summary}</p>
      ) : null}
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
        action_id: {interrupt.action_id ?? "—"}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={isProcessing}
          onClick={onApprove}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle className="h-4 w-4" aria-hidden="true" />
          예약 승인
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isProcessing}
          onClick={onReject}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          취소
        </Button>
      </div>
    </div>
  );
}
