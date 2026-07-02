"use client";

import { LogIn, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { LibraryLoginModal } from "@/components/library/LibraryLoginModal";
import { Skeleton } from "@/components/ui/skeleton";
import { getLmsSsoInitUrl, getSsoInitUrl } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

interface WidgetFrameProps {
  icon: LucideIcon;
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Compact home-widget shell: icon+label header, card surface.
 * `data-widget-frame` lets the grid's density class shrink the padding.
 */
export function WidgetFrame({
  icon: Icon,
  title,
  headerRight,
  children,
  className,
}: WidgetFrameProps) {
  return (
    <section
      data-widget-frame
      className={cn(
        "flex h-full flex-col rounded-card border border-hairline bg-surface p-4 shadow-e1 transition-[padding] duration-200",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-subtle">
          <Icon size={16} className="shrink-0" aria-hidden />
          <h3 className="truncate text-[12px] font-bold tracking-[0.02em]">{title}</h3>
        </div>
        {headerRight}
      </header>
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}

export function WidgetSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-5 w-full", i === lines - 1 && "w-2/3")} />
      ))}
    </div>
  );
}

export function WidgetError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-control bg-muted px-3 py-2.5">
      <p className="text-[12px] text-muted-foreground">불러오지 못했어요</p>
      <button
        type="button"
        onClick={onRetry}
        className="press inline-flex items-center gap-1 rounded-control px-2 py-1 text-[12px] font-bold text-primary hover:bg-primary-soft"
      >
        <RefreshCw size={13} aria-hidden />
        다시 시도
      </button>
    </div>
  );
}

type ConnectProvider = "saint" | "lms" | "library";

const CONNECT_COPY: Record<ConnectProvider, { label: string; hint: string }> = {
  saint: { label: "u-SAINT 연결 필요", hint: "연결하면 내 학사 정보를 보여드려요" },
  lms: { label: "LMS 연결 필요", hint: "연결하면 과제·마감 현황을 보여드려요" },
  library: { label: "도서관 연결 필요", hint: "연결하면 실시간 좌석·대출 현황을 보여드려요" },
};

/** Honest auth-gated state — never renders fake data. */
export function WidgetConnect({ provider }: { provider: ConnectProvider }) {
  const [showLibraryLogin, setShowLibraryLogin] = useState(false);
  const copy = CONNECT_COPY[provider];

  const handleConnect = () => {
    if (provider === "library") {
      setShowLibraryLogin(true);
      return;
    }
    window.location.href = provider === "lms" ? getLmsSsoInitUrl() : getSsoInitUrl();
  };

  return (
    <div className="flex h-full flex-col items-start justify-center gap-1.5 rounded-control bg-muted/60 px-3 py-3">
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
        <LogIn size={14} aria-hidden />
        {copy.label}
      </p>
      <p className="text-[11px] leading-relaxed text-subtle">{copy.hint}</p>
      <button
        type="button"
        onClick={handleConnect}
        className="press mt-0.5 text-[12px] font-bold text-primary"
      >
        연결하기
      </button>
      {showLibraryLogin ? (
        <LibraryLoginModal onClose={() => setShowLibraryLogin(false)} />
      ) : null}
    </div>
  );
}

export function WidgetEmpty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-3 text-center">
      <p className="text-[13px] font-semibold text-muted-foreground">{title}</p>
      {sub ? <p className="mt-1 text-[11px] text-subtle">{sub}</p> : null}
    </div>
  );
}
