"use client";

import { isLibraryAuthError, useCancelWait, useCurrentWait } from "@/hooks/useLibraryReservation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export function WaitStatusCard() {
  const { data: intent, error, isLoading } = useCurrentWait();
  const cancelMutation = useCancelWait();

  if (!isLoading && isLibraryAuthError(error)) {
    return null;
  }
  if (!intent && !isLoading) return null;

  const isTerminal = intent && TERMINAL_STATUSES.has(intent.status);

  return (
    <Card className="h-full border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <CardHeader>
        <CardTitle className="text-base">대기 좌석 예약</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">확인 중...</p>
        ) : intent ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">{STATUS_LABEL[intent.status] ?? intent.status}</p>
              <p className="text-xs text-muted-foreground">
                시도: {intent.attemptCount}회 · 만료:{" "}
                {new Date(intent.expiresAt).toLocaleTimeString()}
              </p>
              {intent.outcomeMessage ? (
                <p className="mt-1 text-xs text-muted-foreground">{intent.outcomeMessage}</p>
              ) : null}
            </div>
            {!isTerminal ? (
              <Button
                size="sm"
                variant="outline"
                disabled={cancelMutation.isPending}
                onClick={() => void cancelMutation.mutateAsync()}
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
