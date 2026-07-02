"use client";

import { GraduationCap } from "lucide-react";

import { SaintLoginButton } from "@/components/auth/SaintLoginButton";
import { AssignmentsCard } from "@/components/lms/AssignmentsCard";
import { ChapelCard } from "@/components/saint/ChapelCard";
import { GradesCard } from "@/components/saint/GradesCard";
import { GraduationCard } from "@/components/saint/GraduationCard";
import { ScholarshipsCard } from "@/components/saint/ScholarshipsCard";
import { WeeklyTimetable } from "@/components/saint/WeeklyTimetable";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaintAuth } from "@/hooks/useSaintAuth";

function AcademicsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-52 w-full rounded-card" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-60 w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}

function LoginGate() {
  return (
    <div className="flex min-h-[60vh] animate-fadeUp items-center justify-center">
      <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8 text-center shadow-e1">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-primary-soft">
          <GraduationCap size={28} className="text-primary-soft-foreground" aria-hidden />
        </span>
        <h2 className="mt-5 text-[17px] font-extrabold text-foreground">
          u-SAINT 로그인이 필요해요
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          시간표·성적·졸업 요건·채플·장학금·LMS 과제를 한 번에 보려면 SmartID로 로그인해 주세요.
        </p>
        <SaintLoginButton label="SmartID 로그인" className="mt-6 w-full" />
        <p className="mt-3 text-[11.5px] text-subtle">
          학교 로그인 페이지에서 본인 확인 후 돌아와요. 세션은 최대 7일 유지돼요.
        </p>
      </div>
    </div>
  );
}

export default function AcademicsPage() {
  const { isAuthenticated, isLoading } = useSaintAuth();

  if (isLoading) {
    return <AcademicsSkeleton />;
  }

  if (!isAuthenticated) {
    return <LoginGate />;
  }

  return (
    <div className="animate-fadeUp space-y-4">
      {/* 주간 시간표 — full width */}
      <WeeklyTimetable />

      {/* 졸업 요건 · 누적 성적 · 채플 · 장학금 · LMS */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <GraduationCard />
        <div className="grid gap-4">
          <GradesCard />
          <ChapelCard />
        </div>
        <ScholarshipsCard />
        <AssignmentsCard />
      </div>
    </div>
  );
}
