"use client";

import {
  AlertTriangle,
  BookOpen,
  Cable,
  CheckCircle2,
  GraduationCap,
  HelpCircle,
  LogIn,
  MonitorPlay,
} from "lucide-react";
import { useState } from "react";

import { LibraryLoginModal } from "@/components/library/LibraryLoginModal";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useLibraryAuth } from "@/contexts/LibraryAuthContext";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { getLmsSsoInitUrl, getSsoInitUrl } from "@/lib/api/auth";
import type { ProviderConnectionState } from "@/lib/mcpConnections";

import { useConnections } from "./useConnections";

/** Connection badge (N/3) + service-connection cards panel. */
export function ConnectionBadge() {
  const conns = useConnections();
  const [open, setOpen] = useState(false);
  const providerStates = [conns.saint, conns.lms, conns.library];
  const degraded = providerStates.includes("degraded");
  const unverified = providerStates.includes("unverified");
  const allConnected = conns.status === "verified" && conns.count === 3 && !unverified;
  const checking = conns.status === "checking";
  const stale = conns.status === "stale";
  const sessionError = conns.status === "error";
  const badgeCount = checking || stale || sessionError ? "?" : conns.count;
  const badgeLabel = checking
    ? "확인 중"
    : sessionError
      ? "오류"
      : stale || degraded
        ? "확인 필요"
        : unverified
          ? "상태 미확인"
          : "연결";
  const ariaLabel = checking
    ? "서비스 연결 상태 확인 중"
    : conns.status === "stale"
      ? `서비스 연결 상태 확인 불가, 마지막 확인 ${conns.lastKnownCount}/3`
      : conns.status === "error"
        ? "서비스 연결 세션 오류"
        : `서비스 연결 ${conns.count}/3${
            degraded
              ? ", 일부 상태 확인 필요"
              : unverified
                ? ", 일부 상태 미확인"
                : ""
          }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className={`press inline-flex h-9 items-center gap-1.5 rounded-pill border px-3 text-[12.5px] font-bold ${
          allConnected
            ? "border-success/30 bg-success-bg text-success"
            : sessionError
              ? "border-danger/30 bg-danger-bg text-danger"
              : stale || degraded || (conns.count > 0 && conns.count < 3)
                ? "border-warning/30 bg-warning-bg text-warning"
                : unverified
                  ? "border-primary/30 bg-primary-soft text-primary"
                  : "border-border bg-surface text-muted-foreground"
        }`}
      >
        <Cable size={15} aria-hidden />
        <span key={`${badgeCount}-${badgeLabel}`} className="inline-block animate-springPop font-mono">
          {badgeCount}
        </span>
        <span>/3</span>
        <span className="hidden sm:inline">{badgeLabel}</span>
      </button>
      <ConnectionsPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface ServiceRowProps {
  icon: React.ReactNode;
  name: string;
  desc: string;
  state: ProviderConnectionState;
  onConnect: () => void;
  onDisconnect?: () => void;
  /** Shown in place of a disconnect button when the service has no standalone
   * session to release (e.g. LMS rides on the u-SAINT login). */
  connectedNote?: string;
}

function ServiceCard({
  icon,
  name,
  desc,
  state,
  onConnect,
  onDisconnect,
  connectedNote,
}: ServiceRowProps) {
  const connected = state === "connected";
  const unverified = state === "unverified";
  const needsAttention = state === "degraded" || state === "stale";

  return (
    <div
      className={`rounded-card border p-4 transition-colors ${
        connected
          ? "border-success/30 bg-success-bg"
          : unverified
            ? "border-primary/30 bg-primary-soft/50"
            : needsAttention
              ? "border-warning/30 bg-warning-bg/50"
              : "border-hairline bg-surface"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-control ${
            connected
              ? "bg-success/15 text-success"
              : unverified
                ? "bg-primary/10 text-primary"
                : needsAttention
                  ? "bg-warning/15 text-warning"
                  : "bg-primary-soft text-primary-soft-foreground"
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-foreground">
            {name}
            {connected && (
              <CheckCircle2 size={15} className="animate-springPop text-success" aria-hidden />
            )}
            {unverified && (
              <HelpCircle size={15} className="animate-springPop text-primary" aria-hidden />
            )}
            {needsAttention && (
              <AlertTriangle size={15} className="animate-springPop text-warning" aria-hidden />
            )}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      {state === "stale" ? (
        <p className="mt-2.5 text-center text-[12px] font-semibold text-warning">
          현재 상태 확인 불가 · 자동 재확인
        </p>
      ) : state === "degraded" ? (
        <button
          type="button"
          onClick={onConnect}
          aria-label={`${name} 다시 연결`}
          className="press mt-2.5 inline-flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[9px] border border-warning/30 bg-surface text-[12.5px] font-semibold text-warning hover:bg-warning-bg"
        >
          <LogIn size={14} aria-hidden />
          다시 연결
        </button>
      ) : unverified ? (
        <div className="mt-2.5">
          <p className="text-center text-[12px] font-semibold text-primary">
            {connectedNote
              ? `${connectedNote} · 상태 미확인`
              : "연결됨 · 상태 미확인"}
          </p>
          {onDisconnect ? (
            <button
              type="button"
              onClick={onDisconnect}
              aria-label={`${name} 연결 해제`}
              className="press mt-2 h-[34px] w-full rounded-[9px] border border-border bg-surface text-[12.5px] font-semibold text-subtle hover:text-foreground"
            >
              연결 해제
            </button>
          ) : null}
        </div>
      ) : connected ? (
        onDisconnect ? (
          <button
            type="button"
            onClick={onDisconnect}
            aria-label={`${name} 연결 해제`}
            className="press mt-2.5 h-[34px] w-full rounded-[9px] border border-border bg-surface text-[12.5px] font-semibold text-subtle hover:text-foreground"
          >
            연결 해제
          </button>
        ) : (
          <p className="mt-2.5 text-center text-[12px] font-semibold text-success">
            {connectedNote ?? "연결됨 · 최대 7일 유지"}
          </p>
        )
      ) : (
        <button
          type="button"
          onClick={onConnect}
          aria-label={`${name} ${state === "expired" ? "다시 연결" : "연결"}`}
          className="press mt-2.5 inline-flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[9px] bg-primary text-[12.5px] font-semibold text-white hover:bg-primary-600"
        >
          <LogIn size={14} aria-hidden />
          {state === "expired" ? "다시 연결" : "연결"}
        </button>
      )}
    </div>
  );
}

export function ConnectionsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const conns = useConnections();
  const { logout: saintLogout } = useSaintAuth();
  const { logout: libraryLogout } = useLibraryAuth();
  const { toast } = useToast();
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  return (
    <>
      <Sheet open={open} onClose={onClose} title="서비스 연결" side="responsive">
        <p className="mb-4 text-[12.5px] text-muted-foreground">
          u-SAINT · LMS · 도서관을 각각 연결하면 개인 데이터 기능이 열립니다. 세션은 최대 7일
          유지됩니다.
        </p>
        {conns.status === "stale" ? (
          <p
            role="status"
            className="mb-4 rounded-control border border-warning/30 bg-warning-bg px-3.5 py-2.5 text-[12px] font-semibold text-warning"
          >
            현재 연결 상태를 확인하지 못했습니다. 마지막 확인은 {conns.lastKnownCount}/3이며
            자동으로 다시 확인합니다.
          </p>
        ) : conns.status === "error" ? (
          <p
            role="alert"
            className="mb-4 rounded-control border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-[12px] font-semibold text-danger"
          >
            연결 세션을 확인하지 못했습니다. 각 서비스를 다시 연결해 주세요.
          </p>
        ) : null}
        <div className="flex flex-col gap-3">
          <ServiceCard
            icon={<GraduationCap size={18} aria-hidden />}
            name="u-SAINT"
            desc="시간표 · 성적 · 채플 · 졸업요건 · 장학금"
            state={conns.saint}
            onConnect={() => {
              window.location.href = getSsoInitUrl();
            }}
            onDisconnect={() => {
              void saintLogout().then(() => toast("info", "u-SAINT 연결이 해제되었습니다"));
            }}
          />
          <ServiceCard
            icon={<MonitorPlay size={18} aria-hidden />}
            name="LMS"
            desc="과제 · 강의 자료 · 대시보드"
            state={conns.lms}
            onConnect={() => {
              window.location.href = getLmsSsoInitUrl();
            }}
            // LMS shares the u-SAINT SSO session — one login connects both, and
            // it is released together from the u-SAINT card. Say so instead of
            // showing a lone "연결됨" that reads as an inconsistency.
            connectedNote="u-SAINT 로그인에 포함 · 최대 7일"
          />
          <ServiceCard
            icon={<BookOpen size={18} aria-hidden />}
            name="도서관"
            desc="좌석 예약 · 대출 현황"
            state={conns.library}
            onConnect={() => {
              onClose();
              setShowLibraryModal(true);
            }}
            onDisconnect={() => {
              void libraryLogout().then(() => toast("info", "도서관 연결이 해제되었습니다"));
            }}
          />
        </div>
      </Sheet>
      {showLibraryModal && <LibraryLoginModal onClose={() => setShowLibraryModal(false)} />}
    </>
  );
}
