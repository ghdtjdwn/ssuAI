"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { InterruptData } from "@/lib/api/agent";
import { cn } from "@/lib/utils";

interface HitlCardProps {
  interrupt: InterruptData;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

/**
 * One-line summary of the action awaiting approval. Same field mapping as the
 * original implementation: free-form `message` wins, otherwise structured
 * seat/room/action parts joined with " · ".
 */
export function formatHitlSummary(details: Record<string, unknown> | undefined): string {
  if (!details) return "";
  if (details.message) return String(details.message);
  const parts: string[] = [];
  if (details.seatCode) parts.push(`좌석 ${String(details.seatCode)}`);
  if (details.roomName) parts.push(String(details.roomName));
  if (details.actionType) parts.push(String(details.actionType));
  return parts.join(" · ");
}

export function HitlCard({ interrupt, onApprove, onReject, isProcessing }: HitlCardProps) {
  const { toast } = useToast();
  const summary = formatHitlSummary(interrupt.details);
  // Structured seat/time parts read best in mono; free-form prose does not.
  const isStructuredSummary = !interrupt.details?.message;

  function handleApprove() {
    toast("success", "승인했어요. 요청을 실행할게요.");
    onApprove();
  }

  function handleReject() {
    toast("info", "요청을 취소했어요.");
    onReject();
  }

  return (
    <div className="w-full max-w-[min(26rem,85%)] animate-sheetUp self-start rounded-card border border-warning/30 bg-warning-bg p-4 shadow-e1 lg:animate-fadeUp">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-warning/15 text-warning">
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-tight text-foreground">승인이 필요한 작업이에요</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">내용을 확인한 뒤 진행할게요</p>
        </div>
      </div>
      {summary ? (
        <p
          className={cn(
            "mt-3 rounded-control bg-surface/70 px-3 py-2 text-[12.5px] leading-relaxed text-foreground",
            isStructuredSummary && "font-mono",
          )}
        >
          {summary}
        </p>
      ) : null}
      <div className="mt-3.5 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={isProcessing}
          onClick={handleApprove}
          className="gap-1.5 border-transparent bg-success text-white hover:bg-success hover:opacity-90"
        >
          <CheckCircle2 size={15} aria-hidden="true" />
          승인
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={isProcessing}
          onClick={handleReject}
          className="gap-1.5"
        >
          <XCircle size={15} aria-hidden="true" />
          취소
        </Button>
      </div>
    </div>
  );
}

/** Completed state the pending card swaps into once the user approves. */
export function HitlDoneCard({ summary }: { summary?: string }) {
  return (
    <div className="w-full max-w-[min(26rem,85%)] animate-springPop self-start rounded-card border border-success/30 bg-success-bg p-3.5">
      <div className="flex items-center gap-2.5">
        <CheckCircle2 size={20} className="shrink-0 animate-springPop text-success" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-success">승인 완료</p>
          {summary ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{summary}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
