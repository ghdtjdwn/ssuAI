"use client";

import { useState } from "react";

import { Sparkles, Utensils } from "lucide-react";
import Link from "next/link";

import { AcademicCalendarCard } from "@/components/campus/AcademicCalendarCard";
import { DormWeeklyCard } from "@/components/dorm/DormWeeklyCard";
import { FacilitySearchCard } from "@/components/facility/FacilitySearchCard";
import { TodayMealCard } from "@/components/meal/TodayMealCard";
import { WeeklyMealCard } from "@/components/meal/WeeklyMealCard";
import { NoticesCard } from "@/components/notice/NoticesCard";
import { Segmented } from "@/components/ui/segmented";

type MealView = "today" | "weekly";

const MEAL_VIEW_OPTIONS: { value: MealView; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "weekly", label: "주간" },
];

const EXAMPLE_QUESTIONS = ["휴학 최대 몇 년까지 돼?", "조기졸업 요건이 뭐야?"];

/** Navigation-only promo panel: rules/graduation/scholarship Q&A lives in /chat. */
function EvidenceSearchPromo() {
  return (
    <section
      aria-label="AI 근거 검색"
      className="hero-gradient rounded-card p-5 text-white shadow-e2"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles size={16} className="text-mint-glow-soft" aria-hidden="true" />
        <span className="text-[12px] font-bold text-primary-100">AI 근거 검색</span>
      </div>
      <p className="mt-2.5 text-[15px] font-extrabold leading-snug">
        학칙·졸업·장학, 근거 문서와 함께 답해드려요
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-primary-100">
        답변마다 학칙·시행세칙 등 출처 문서를 함께 보여드려요.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLE_QUESTIONS.map((question) => (
          <Link
            key={question}
            href="/chat"
            className="press rounded-pill border border-white/25 bg-white/10 px-3 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-white/20"
          >
            “{question}”
          </Link>
        ))}
      </div>
      <div className="mt-4">
        <Link
          href="/chat"
          className="press inline-flex h-[34px] items-center gap-1.5 rounded-control bg-white px-3.5 text-[12.5px] font-bold text-primary-600"
        >
          <Sparkles size={14} aria-hidden="true" />
          챗봇에게 물어보기
        </Link>
      </div>
    </section>
  );
}

export default function CampusPage() {
  const [mealView, setMealView] = useState<MealView>("today");

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-5">
      {/* Left column: meals */}
      <div className="flex animate-fadeUp flex-col gap-4">
        <section aria-label="학식" className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
              <Utensils size={15} aria-hidden="true" />
              학식
            </span>
            <Segmented
              size="sm"
              options={MEAL_VIEW_OPTIONS}
              value={mealView}
              onChange={setMealView}
            />
          </div>
          {mealView === "today" ? <TodayMealCard /> : <WeeklyMealCard />}
        </section>

        <DormWeeklyCard />
        <AcademicCalendarCard />
      </div>

      {/* Right column: notices, evidence search, facilities */}
      <div className="flex animate-fadeUp flex-col gap-4 [animation-delay:60ms]">
        <NoticesCard />
        <EvidenceSearchPromo />
        <FacilitySearchCard />
      </div>
    </div>
  );
}
