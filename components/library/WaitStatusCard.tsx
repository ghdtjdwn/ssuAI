"use client";

import { Hourglass } from "lucide-react";

import { isLibraryAuthError, useCancelWait, useCurrentWait } from "@/hooks/useLibraryReservation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

const STATUS_LABEL: Record<string, string> = {
  WAITING_FOR_SEAT: "좌석 대기 중",
  RESERVING: "예약 처리 중",
  SUCCEEDED: "예약 완료",
  FAILED_RACE: "다른 사용자에게 선점됨",
  FAILED_AUTH: "인증 만료",
  FAILED_UPSTREAM: "시스템 오류",
  CANCELLED: "취소됨",
  EXPIRED: "만료됨",
};

const TERMINAL_STATUSES = new Set([
  "SUCCEEDED",
  "FAILED_RACE",
  "FAILED_AUTH",
  "FAILED_UPSTREAM",
  "CANCELLED",
  "EXPIRED",
]);

function statusBadgeVariant(status: string) {
  if (status === "SUCCEEDED") return "success" as const;
  if (status === "WAITING_FOR_SEAT" || status === "RESERVING") return "warning" as const;
  if (status.startsWith("FAILED")) return "destructive" as const;
  return "secondary" as const;
}

export function WaitStatusCard() {
  const { data: intent, error, isLoading } = useCurrentWait();
  const cancelMutation = useCancelWait();
  const { toast } = useToast();

  if (!isLoading && isLibraryAuthError(error)) {
    return null;
  }
  if (!intent && !isLoading) return null;

  const isTerminal = intent && TERMINAL_STATUSES.has(intent.status);

  return (
    <Card className="h-full border-warning/25 bg-warning-bg/40">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Hourglass size={16} className="text-warning" aria-hidden />
        <CardTitle className="text-[14px]">내 좌석 · 대기 상태</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">확인 중...</p>
        ) : intent ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(intent.status)}>
                  {STATUS_LABEL[intent.status] ?? intent.status}
                </Badge>
              </div>
              <p className="text-[12px] text-muted-foreground">
                시도 <span className="font-mono font-bold text-foreground">{intent.attemptCount}</span>회
                {" · "}만료{" "}
                <span className="font-mono font-bold text-foreground">
                  {new Date(intent.expiresAt).toLocaleTimeString()}
                </span>
              </p>
              {intent.outcomeMessage ? (
                <p className="text-[12px] text-muted-foreground">{intent.outcomeMessage}</p>
              ) : null}
            </div>
            {!isTerminal ? (
              <Button
                size="sm"
                variant="outline"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  void cancelMutation
                    .mutateAsync()
                    .then(() => toast("info", "좌석 대기를 취소했어요."))
                    .catch(() => toast("error", "대기 취소에 실패했어요. 다시 시도해주세요."));
                }}
              >
                {cancelMutation.isPending ? "취소 중..." : "대기 취소"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
