"use client";

import { useEffect, useRef, useState } from "react";

import { BookOpen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Portal } from "@/components/ui/portal";
import { useLibraryAuth } from "@/contexts/LibraryAuthContext";
import { loginLibrary } from "@/lib/api/library";
import { encryptLibraryPassword } from "@/lib/crypto";
import { useQueryClient } from "@tanstack/react-query";

const MODAL_CLOSE_DELAY_MS = 800;

const INPUT_CLASS =
  "w-full rounded-control border border-input bg-surface px-3.5 py-2.5 text-base text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 sm:text-sm";

interface LibraryLoginModalProps {
  onClose: () => void;
}

export function LibraryLoginModal({ onClose }: LibraryLoginModalProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { markCredentialsRefreshed } = useLibraryAuth();
  const queryClient = useQueryClient();
  const loginIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Avoid opening the software keyboard before a touch user chooses a field.
    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (!coarsePointer) loginIdRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginId.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await loginLibrary(loginId.trim(), await encryptLibraryPassword(password));
      setSuccess(true);
      markCredentialsRefreshed();
      await queryClient.invalidateQueries({ queryKey: ["library", "loans"] });
      await queryClient.invalidateQueries({ queryKey: ["library", "seats"] });
      await queryClient.invalidateQueries({ queryKey: ["library", "recommendations"] });
      await queryClient.invalidateQueries({ queryKey: ["library", "wait"] });
      setTimeout(onClose, MODAL_CLOSE_DELAY_MS);
    } catch {
      setError("로그인에 실패했습니다. 학번과 비밀번호를 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pb-[env(safe-area-inset-bottom)] animate-fadeIn sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-login-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full overflow-y-auto overscroll-contain rounded-t-card border border-hairline bg-surface p-5 shadow-e3 animate-sheetUp sm:max-w-sm sm:rounded-card sm:p-6 sm:animate-fadeUp">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary-soft-foreground">
                <BookOpen size={17} aria-hidden />
              </span>
              <div>
                <h2 id="library-login-title" className="text-[15px] font-extrabold text-foreground">
                  도서관 연동
                </h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  대출 현황 조회를 위해 학교 계정으로 로그인합니다.
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="닫기"
              className="press -mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="library-login-id" className="mb-1 block text-xs font-bold text-muted-foreground">
                학번
              </label>
              <input
                id="library-login-id"
                ref={loginIdRef}
                type="text"
                inputMode="numeric"
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="20221528"
                disabled={submitting || success}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="library-password" className="mb-1 block text-xs font-bold text-muted-foreground">
                비밀번호 (유세인트 비밀번호)
              </label>
              <input
                id="library-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting || success}
                className={INPUT_CLASS}
              />
            </div>

            {error && <p className="text-sm font-medium text-danger">{error}</p>}
            {success && (
              <p className="text-sm font-bold text-success animate-springPop">연동 완료!</p>
            )}

            <p className="text-[11.5px] leading-relaxed text-subtle">
              비밀번호는 도서관 로그인에만 사용되며 ssuAI 서버에 저장되지 않습니다.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-10 sm:min-h-[34px]"
                onClick={onClose}
              >
                취소
              </Button>
              <Button
                type="submit"
                size="sm"
                className="min-h-10 sm:min-h-[34px]"
                disabled={!loginId.trim() || !password || submitting || success}
              >
                {submitting ? "로그인 중…" : "연동"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
