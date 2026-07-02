"use client";

import { Bot, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useSaintAuth } from "@/hooks/useSaintAuth";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "유세인트 로그인에 실패했어요. 다시 시도해 주세요.",
  portal_unavailable:
    "유세인트 포털이 응답하지 않아요. 잠시 후 다시 시도해 주세요.",
  lms_auth_failed: "LMS 로그인에 실패했어요. 다시 시도해 주세요.",
  lms_unknown: "LMS 로그인 처리 중 알 수 없는 오류가 발생했어요. 다시 시도해 주세요.",
  unknown: "알 수 없는 오류가 발생했어요. 다시 시도해 주세요.",
};

function PendingLine({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 size={16} className="animate-spin text-primary" aria-hidden />
      {label}
    </p>
  );
}

function AuthReturnContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useSaintAuth();
  const ok = params.get("ok") === "1";
  const lmsOk = params.get("lms_ok") === "1";
  const errorCode = params.get("error");
  const [refreshSettled, setRefreshSettled] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    if (!ok && !lmsOk) return;
    let cancelled = false;
    refresh().then((success) => {
      if (cancelled) return;
      setRefreshSettled(true);
      if (success) {
        router.replace("/");
      } else {
        setRefreshFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ok, lmsOk, refresh, router]);

  // Pending only on the success path while the refresh round-trip is in
  // flight. The error path renders immediately; no effect involved.
  const pending = (ok || lmsOk) && !refreshSettled;

  if (pending) {
    return <PendingLine label="로그인 처리 중…" />;
  }

  if (refreshFailed) {
    return (
      <>
        <h1 className="text-[19px] font-extrabold text-foreground">세션을 만들지 못했어요</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          SSO 는 통과했지만 ssuAI 세션 갱신에 실패했습니다. 잠시 후 다시
          시도해 주세요.
        </p>
        <Link
          href="/auth/login"
          className="text-sm font-semibold text-primary underline underline-offset-2"
        >
          다시 로그인하기
        </Link>
      </>
    );
  }

  if (ok || lmsOk) {
    // success path — already redirected via router.replace("/"); component is
    // about to unmount, render a quiet placeholder.
    return null;
  }

  const message = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.unknown)
    : ERROR_MESSAGES.unknown;

  return (
    <>
      <h1 className="text-[19px] font-extrabold text-foreground">로그인 실패</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
      <Link
        href="/auth/login"
        className="text-sm font-semibold text-primary underline underline-offset-2"
      >
        다시 시도
      </Link>
    </>
  );
}

export default function AuthReturnPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-md animate-fadeUp rounded-card border border-hairline bg-surface p-8 shadow-e2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-primary shadow-[0_2px_8px_rgba(11,77,162,.28)]">
            <Bot size={22} className="text-white" aria-hidden />
          </span>
          <div>
            <p className="text-[15px] font-extrabold leading-tight text-foreground">ssuAI</p>
            <p className="text-[11px] leading-tight text-subtle">숭실대 어시스턴트</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Suspense fallback={<PendingLine label="로딩 중…" />}>
            <AuthReturnContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
