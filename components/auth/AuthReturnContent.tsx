"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSaintAuth } from "@/hooks/useSaintAuth";
import { exchangeAuthCode } from "@/lib/api/auth";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "유세인트 로그인에 실패했어요. 다시 시도해 주세요.",
  portal_unavailable:
    "유세인트 포털이 응답하지 않아요. 잠시 후 다시 시도해 주세요.",
  lms_auth_failed: "LMS 로그인에 실패했어요. 다시 시도해 주세요.",
  lms_unknown: "LMS 로그인 처리 중 알 수 없는 오류가 발생했어요. 다시 시도해 주세요.",
  unknown: "알 수 없는 오류가 발생했어요. 다시 시도해 주세요.",
};

export function PendingLine({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 size={16} className="animate-spin text-primary" aria-hidden />
      {label}
    </p>
  );
}

export function AuthReturnContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useSaintAuth();
  const ok = params.get("ok") === "1";
  const lmsOk = params.get("lms_ok") === "1";
  const code = params.get("code");
  const errorCode = params.get("error");
  const [refreshSettled, setRefreshSettled] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  // Single-flights the one-time code exchange across React StrictMode's
  // duplicate effect invocation (same pattern as the refreshInFlight ref in
  // hooks/useSaintAuth.tsx). The exchange code is single-use — a second POST
  // with the same code would 401, so the second effect instance must await
  // the same in-flight exchange rather than firing its own.
  const exchangeInFlightRef = useRef<Promise<void> | null>(null);

  const hasReturnFlow = ok || lmsOk || !!code;

  useEffect(() => {
    if (!hasReturnFlow) return;
    let cancelled = false;

    (async () => {
      try {
        if (code) {
          if (!exchangeInFlightRef.current) {
            exchangeInFlightRef.current = exchangeAuthCode(code).then(() => undefined);
          }
          await exchangeInFlightRef.current;
        }
        const success = await refresh();
        if (cancelled) return;
        setRefreshSettled(true);
        if (success) {
          router.replace("/");
        } else {
          setRefreshFailed(true);
        }
      } catch {
        if (cancelled) return;
        setRefreshSettled(true);
        setRefreshFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasReturnFlow, code, refresh, router]);

  // Pending only on the success path while the exchange/refresh round-trip is
  // in flight. The error path renders immediately; no effect involved.
  const pending = hasReturnFlow && !refreshSettled;

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

  if (hasReturnFlow) {
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
