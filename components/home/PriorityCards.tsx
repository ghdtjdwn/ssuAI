"use client";

import type { LucideIcon } from "lucide-react";
import { Armchair, CheckCircle2, Church, Clock, LogIn } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { LibraryLoginModal } from "@/components/library/LibraryLoginModal";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLmsAssignments } from "@/hooks/useLmsAssignments";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintGraduation } from "@/hooks/useSaintGraduation";
import { getLmsSsoInitUrl, getSsoInitUrl } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

import {
  dDayLabel,
  findRequirement,
  formatMonthDay,
  seatTone,
  seatToneTextClass,
} from "./home-utils";
import { upcomingDeadlines } from "./widgets/DeadlineWidget";
import { useLibraryZones } from "./useLibraryZones";

interface PriorityCardProps {
  badge: string;
  badgeVariant: BadgeProps["variant"];
  icon: LucideIcon;
  tileClass: string;
  title: string;
  metric?: React.ReactNode;
  metricClass?: string;
  desc: string;
  cta: React.ReactNode;
}

function PriorityCard({
  badge,
  badgeVariant,
  icon: Icon,
  tileClass,
  title,
  metric,
  metricClass,
  desc,
  cta,
}: PriorityCardProps) {
  return (
    <article className="flex flex-col rounded-card border border-hairline bg-surface p-4 shadow-e1">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={badgeVariant}>{badge}</Badge>
        <span
          className={cn(
            "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-control",
            tileClass,
          )}
        >
          <Icon size={18} aria-hidden />
        </span>
      </div>
      <h3 className="mt-2.5 truncate text-[14.5px] font-bold text-foreground">{title}</h3>
      {metric ? (
        <div className={cn("mt-0.5 font-mono text-[12px] font-semibold", metricClass)}>
          {metric}
        </div>
      ) : null}
      <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-muted-foreground">{desc}</p>
      <div className="mt-3">{cta}</div>
    </article>
  );
}

function ConnectNudgeCard({
  icon: Icon,
  title,
  desc,
  onConnect,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  onConnect: () => void;
}) {
  return (
    <article className="flex flex-col rounded-card border border-dashed border-border bg-surface p-4 shadow-e1">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary">연결하면 보여드려요</Badge>
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground">
          <Icon size={18} aria-hidden />
        </span>
      </div>
      <h3 className="mt-2.5 text-[14.5px] font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-muted-foreground">{desc}</p>
      <div className="mt-3">
        <Button variant="secondary" size="sm" className="w-full" onClick={onConnect}>
          <LogIn size={15} aria-hidden />
          연결하기
        </Button>
      </div>
    </article>
  );
}

function CardSkeleton() {
  return <Skeleton className="h-[178px] w-full rounded-card" />;
}

/**
 * Three rule-based priority cards: (a) soonest LMS deadline,
 * (b) most-available library space right now, (c) chapel remaining.
 * Unconnected sources swap to an honest connect-nudge card — never fake data.
 */
export function PriorityCards() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();
  const lmsQ = useLmsAssignments(accessToken);
  const gradQ = useSaintGraduation(accessToken);
  const {
    bestZone,
    isLoading: zonesLoading,
    needsAuth: libraryNeedsAuth,
  } = useLibraryZones();
  const [showLibraryLogin, setShowLibraryLogin] = useState(false);

  // --- (a) 마감 임박 ---
  let deadlineCard: React.ReactNode;
  if (authLoading || (isAuthenticated && lmsQ.isLoading)) {
    deadlineCard = <CardSkeleton />;
  } else if (!isAuthenticated) {
    deadlineCard = (
      <ConnectNudgeCard
        icon={Clock}
        title="마감 임박 과제"
        desc="LMS를 연결하면 가장 급한 마감을 골라 알려드려요."
        onConnect={() => (window.location.href = getLmsSsoInitUrl())}
      />
    );
  } else {
    const soonest = upcomingDeadlines(lmsQ.data?.items ?? [], 1)[0];
    if (soonest) {
      const due = soonest.dueDate ? formatMonthDay(soonest.dueDate) : null;
      deadlineCard = (
        <PriorityCard
          badge="마감 임박"
          badgeVariant="warning"
          icon={Clock}
          tileClass="bg-warning-bg text-warning"
          title={soonest.title}
          metric={`${dDayLabel(soonest.dday)}${due ? ` · ~${due}` : ""}`}
          metricClass="text-warning"
          desc={`${soonest.courseName} · 잊기 전에 미리 제출해두는 게 좋아요.`}
          cta={
            <Button asChild variant="secondary" size="sm" className="w-full">
              <Link href="/academics">과제 확인하기</Link>
            </Button>
          }
        />
      );
    } else {
      deadlineCard = (
        <PriorityCard
          badge="마감 없음"
          badgeVariant="success"
          icon={CheckCircle2}
          tileClass="bg-success-bg text-success"
          title="다가오는 마감이 없어요"
          desc="미제출 과제가 없어요. 오늘은 여유롭게 보내도 좋아요."
          cta={
            <Button asChild variant="secondary" size="sm" className="w-full">
              <Link href="/academics">LMS 현황 보기</Link>
            </Button>
          }
        />
      );
    }
  }

  // --- (b) 지금이 적기 ---
  let seatCard: React.ReactNode;
  if (libraryNeedsAuth) {
    seatCard = (
      <ConnectNudgeCard
        icon={Armchair}
        title="지금 여유로운 열람실"
        desc="도서관을 연결하면 실시간으로 가장 한산한 공간을 알려드려요."
        onConnect={() => setShowLibraryLogin(true)}
      />
    );
  } else if (zonesLoading) {
    seatCard = <CardSkeleton />;
  } else if (bestZone) {
    const tone = seatTone(bestZone.available, bestZone.total);
    seatCard = (
      <PriorityCard
        badge="지금이 적기"
        badgeVariant="mint"
        icon={Armchair}
        tileClass="bg-mint-50 text-mint-600 dark:bg-mint-700/20 dark:text-mint-300"
        title={`${bestZone.label} 좌석 여유`}
        metric={`여유 ${bestZone.available} / ${bestZone.total}`}
        metricClass={seatToneTextClass[tone]}
        desc="지금 가장 한산한 공간이에요. 집중하기 딱 좋은 타이밍!"
        cta={
          <Button asChild size="sm" className="w-full">
            <Link href="/library">좌석 예약</Link>
          </Button>
        }
      />
    );
  } else {
    seatCard = (
      <PriorityCard
        badge="지금이 적기"
        badgeVariant="mint"
        icon={Armchair}
        tileClass="bg-mint-50 text-mint-600 dark:bg-mint-700/20 dark:text-mint-300"
        title="도서관 좌석 현황"
        desc="좌석 정보를 불러오지 못했어요. 도서관 탭에서 다시 확인해보세요."
        cta={
          <Button asChild variant="secondary" size="sm" className="w-full">
            <Link href="/library">도서관 열기</Link>
          </Button>
        }
      />
    );
  }

  // --- (c) 잊지 마세요 ---
  let chapelCard: React.ReactNode;
  const chapelReq = findRequirement(gradQ.data, "채플");
  if (authLoading || (isAuthenticated && gradQ.isLoading)) {
    chapelCard = <CardSkeleton />;
  } else if (!isAuthenticated) {
    chapelCard = (
      <ConnectNudgeCard
        icon={Church}
        title="채플 이수 현황"
        desc="u-SAINT를 연결하면 남은 채플 횟수를 챙겨드려요."
        onConnect={() => (window.location.href = getSsoInitUrl())}
      />
    );
  } else if (chapelReq) {
    chapelCard = (
      <PriorityCard
        badge="잊지 마세요"
        badgeVariant="default"
        icon={Church}
        tileClass="bg-primary-soft text-primary-soft-foreground"
        title={
          chapelReq.remaining > 0 ? `채플 ${chapelReq.remaining}회 남음` : "채플 이수 완료"
        }
        metric={`${chapelReq.completed} / ${chapelReq.required} 이수`}
        metricClass="text-primary"
        desc={
          chapelReq.remaining > 0
            ? `${chapelReq.remaining}번만 더 들으면 졸업요건이 충족돼요.`
            : "채플 졸업요건을 이미 충족했어요."
        }
        cta={
          <Button asChild variant="secondary" size="sm" className="w-full">
            <Link href="/academics">채플 현황 보기</Link>
          </Button>
        }
      />
    );
  } else {
    chapelCard = (
      <PriorityCard
        badge="잊지 마세요"
        badgeVariant="default"
        icon={Church}
        tileClass="bg-primary-soft text-primary-soft-foreground"
        title="졸업 요건 점검"
        desc="졸업 요건 현황을 학사 탭에서 한눈에 확인할 수 있어요."
        cta={
          <Button asChild variant="secondary" size="sm" className="w-full">
            <Link href="/academics">학사 열기</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
      {deadlineCard}
      {seatCard}
      {chapelCard}
      {showLibraryLogin ? (
        <LibraryLoginModal onClose={() => setShowLibraryLogin(false)} />
      ) : null}
    </div>
  );
}
