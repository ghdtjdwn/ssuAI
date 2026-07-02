"use client";

import { useEffect, useRef, useState } from "react";

import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirmReservation } from "@/hooks/useLibraryReservation";
import type { LibraryReservationPrepareResponse } from "@/lib/api/library";

interface ReservationConfirmModalProps {
  pendingAction: LibraryReservationPrepareResponse;
  onClose: () => void;
  onSuccess: () => void;
}

const SUCCESS_CLOSE_DELAY_MS = 1500;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ReservationConfirmModal({
  pendingAction,
  onClose,
  onSuccess,
}: ReservationConfirmModalProps) {
  const confirm = useConfirmReservation();
  const { toast } = useToast();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Countdown derives from a ticking clock instead of being set inside the
  // effect, so an expiresAt prop change re-renders with the right value
  // immediately and no setState runs synchronously in the effect body.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const remainingMs = Math.max(0, new Date(pendingAction.expiresAt).getTime() - nowMs);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleConfirm() {
    setErrorMessage(null);
    try {
      const res = await confirm.mutateAsync();
      if (res.status === "SUCCESS" || res.status === "PROCESSING") {
        // PROCESSING: the synchronous confirm timed out but a background worker
        // continues the reservation and usually still succeeds. Treat it as an
        // in-progress (non-error) outcome and refresh the seat view so the
        // worker's eventual result is reflected.
        setSuccessMessage(
          res.status === "SUCCESS"
            ? "예약이 완료되었습니다."
            : "예약을 백그라운드에서 처리 중이에요. 잠시 후 좌석 상태를 확인해주세요.",
        );
        if (res.status === "SUCCESS") {
          toast("success", "좌석 예약이 완료되었어요.");
        } else {
          toast("info", "예약을 백그라운드에서 처리 중이에요.");
        }
        timerRef.current = setTimeout(() => {
          onSuccess();
          onClose();
        }, SUCCESS_CLOSE_DELAY_MS);
      } else {
        setErrorMessage(`예약 실패: ${res.message}`);
      }
    } catch {
      setErrorMessage("예약 처리 중 오류가 발생했습니다.");
    }
  }

  function handleCancel() {
    toast("info", "예약 요청을 취소했어요.");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-6 shadow-e3 animate-fadeUp">
        <h2 id="confirm-modal-title" className="text-[17px] font-extrabold text-foreground">
          예약 확인
        </h2>

        <div className="mt-4 space-y-2.5 rounded-control bg-muted/60 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-[12px] font-medium text-subtle">요청 내용</span>
            <span className="text-right text-[13px] font-medium text-foreground">
              {pendingAction.summary}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-[12px] font-medium text-subtle">유효시간</span>
            <span className="text-[13px] text-muted-foreground">
              <span className="font-mono font-bold text-foreground">
                {formatRemaining(remainingMs)}
              </span>{" "}
              남음
            </span>
          </div>
        </div>

        {successMessage ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-bold text-success animate-springPop">
            <CheckCircle2 size={17} aria-hidden />
            {successMessage}
          </p>
        ) : (
          <>
            {errorMessage ? (
              <p className="mt-3 text-sm font-medium text-danger">{errorMessage}</p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={handleCancel} className="flex-1">
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
