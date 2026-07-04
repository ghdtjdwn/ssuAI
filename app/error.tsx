"use client";

import { RotateCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. Without this, a single client-render throw in any
 * card (e.g. a `.toFixed` on a field that arrived null despite the wire type) is
 * caught only by Next's bare framework fallback ("This page couldn't load"),
 * which blanks the whole route. Here we keep the app shell, show a friendly
 * retry, and log the error so the underlying cause stays diagnosable.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ssuAI route render error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] animate-fadeUp items-center justify-center">
      <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8 text-center shadow-e1">
        <h2 className="text-[17px] font-extrabold text-foreground">
          화면을 불러오지 못했어요
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          일시적인 문제일 수 있어요. 다시 시도해 주세요. 계속되면 잠시 후 새로고침해 주세요.
        </p>
        <Button onClick={reset} className="mt-6 w-full">
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          다시 시도
        </Button>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-subtle">오류 코드: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
