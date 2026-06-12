"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useConfirmReservation } from "@/hooks/useLibraryReservation";
import type { LibraryReservationPrepareResponse } from "@/lib/api/library";

interface ReservationConfirmModalProps {
  pendingAction: LibraryReservationPrepareResponse;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReservationConfirmModal({
  pendingAction,
  onClose,
  onSuccess,
}: ReservationConfirmModalProps) {
  const confirm = useConfirmReservation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleConfirm() {
    setErrorMessage(null);
    try {
      const res = await confirm.mutateAsync();
      if (res.status === "SUCCESS") {
        setSuccessMessage("예약이 완료되었습니다.");
        timerRef.current = setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setErrorMessage(`예약 실패: ${res.message}`);
      }
    } catch {
      setErrorMessage("예약 처리 중 오류가 발생했습니다.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 id="confirm-modal-title" className="text-lg font-semibold">
          예약 확인
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{pendingAction.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          유효시간: {new Date(pendingAction.expiresAt).toLocaleTimeString()}까지
        </p>

        {successMessage ? (
          <p className="mt-4 text-sm font-medium text-green-600 dark:text-green-400">
            {successMessage}
          </p>
        ) : (
          <>
            {errorMessage ? (
              <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                취소
              </Button>
              <Button
                onClick={() => void handleConfirm()}
                disabled={confirm.isPending}
                className="flex-1"
              >
                {confirm.isPending ? "처리 중..." : "예약 확정"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
