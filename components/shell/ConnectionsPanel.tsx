"use client";

import { BookOpen, Cable, CheckCircle2, GraduationCap, LogIn, MonitorPlay } from "lucide-react";
import { useState } from "react";

import { LibraryLoginModal } from "@/components/library/LibraryLoginModal";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useLibraryAuth } from "@/contexts/LibraryAuthContext";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { getLmsSsoInitUrl, getSsoInitUrl } from "@/lib/api/auth";

import { useConnections } from "./useConnections";

/** Connection badge (N/3) + service-connection cards panel. */
export function ConnectionBadge() {
  const { count } = useConnections();
  const [open, setOpen] = useState(false);
  const allConnected = count === 3;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`서비스 연결 ${count}/3`}
        className={`press inline-flex h-9 items-center gap-1.5 rounded-pill border px-3 text-[12.5px] font-bold ${
          allConnected
            ? "border-success/30 bg-success-bg text-success"
            : count > 0
              ? "border-success/30 bg-success-bg text-success"
              : "border-border bg-surface text-muted-foreground"
        }`}
      >
        <Cable size={15} aria-hidden />
        <span key={count} className="inline-block animate-springPop font-mono">
          {count}
        </span>
        <span className="opacity-70">/3</span>
        <span className="hidden sm:inline">연결</span>
      </button>
      <ConnectionsPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface ServiceRowProps {
  icon: React.ReactNode;
  name: string;
  desc: string;
  connected: boolean;
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
  connected,
  onConnect,
  onDisconnect,
  connectedNote,
}: ServiceRowProps) {
  return (
    <div
      className={`rounded-card border p-4 transition-colors ${
        connected ? "border-success/30 bg-success-bg" : "border-hairline bg-surface"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-control ${
            connected ? "bg-success/15 text-success" : "bg-primary-soft text-primary-soft-foreground"
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
          </p>
          <p className="truncate text-[12px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      {connected ? (
        onDisconnect ? (
          <button
            type="button"
            onClick={onDisconnect}
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
          className="press mt-2.5 inline-flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[9px] bg-primary text-[12.5px] font-semibold text-white hover:bg-primary-600"
        >
          <LogIn size={14} aria-hidden />
          연결
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
        <div className="flex flex-col gap-3">
          <ServiceCard
            icon={<GraduationCap size={18} aria-hidden />}
            name="u-SAINT"
            desc="시간표 · 성적 · 채플 · 졸업요건 · 장학금"
            connected={conns.saint}
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
            connected={conns.lms}
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
            connected={conns.library}
            onConnect={() => setShowLibraryModal(true)}
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
