import type { ComponentType } from "react";

import {
  Armchair,
  Award,
  Banknote,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarDays,
  Church,
  Megaphone,
  MonitorPlay,
  Star,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { CalendarWidget } from "./CalendarWidget";
import { ChapelWidget } from "./ChapelWidget";
import { DeadlineWidget } from "./DeadlineWidget";
import { DormMealWidget } from "./DormMealWidget";
import { GpaWidget } from "./GpaWidget";
import { GraduationWidget } from "./GraduationWidget";
import { LibrarySeatsWidget } from "./LibrarySeatsWidget";
import { LmsWidget } from "./LmsWidget";
import { LoansWidget } from "./LoansWidget";
import { NextScheduleWidget } from "./NextScheduleWidget";
import { NoticesWidget } from "./NoticesWidget";
import { ScholarshipWidget } from "./ScholarshipWidget";
import { TimetableWidget } from "./TimetableWidget";
import { TodayMealWidget } from "./TodayMealWidget";

export type HomeWidgetSection = "오늘" | "학사" | "도서관" | "캠퍼스";

export interface HomeWidgetDef {
  id: string;
  section: HomeWidgetSection;
  title: string;
  icon: LucideIcon;
  defaultOn: boolean;
  defaultSpan: 1 | 2;
  component: ComponentType;
}

/**
 * Home widget catalog. Order here = default display order.
 * Default ON = the six 오늘-section widgets (design §1 홈).
 */
export const WIDGET_REGISTRY: HomeWidgetDef[] = [
  { id: "schedule", section: "오늘", title: "다음 일정", icon: Calendar, defaultOn: true, defaultSpan: 1, component: NextScheduleWidget },
  { id: "deadline", section: "오늘", title: "마감 D-day", icon: CalendarClock, defaultOn: true, defaultSpan: 1, component: DeadlineWidget },
  { id: "meal", section: "오늘", title: "오늘 학식", icon: Utensils, defaultOn: true, defaultSpan: 1, component: TodayMealWidget },
  { id: "seats", section: "오늘", title: "도서관 좌석", icon: Armchair, defaultOn: true, defaultSpan: 2, component: LibrarySeatsWidget },
  { id: "notices", section: "오늘", title: "오늘 공지", icon: Megaphone, defaultOn: true, defaultSpan: 1, component: NoticesWidget },
  { id: "chapel", section: "오늘", title: "채플 진행도", icon: Church, defaultOn: true, defaultSpan: 1, component: ChapelWidget },
  { id: "timetable", section: "학사", title: "주간 시간표", icon: CalendarDays, defaultOn: false, defaultSpan: 2, component: TimetableWidget },
  { id: "graduation", section: "학사", title: "졸업 요건", icon: Award, defaultOn: false, defaultSpan: 1, component: GraduationWidget },
  { id: "gpa", section: "학사", title: "누적 성적", icon: Star, defaultOn: false, defaultSpan: 1, component: GpaWidget },
  { id: "scholarship", section: "학사", title: "장학금", icon: Banknote, defaultOn: false, defaultSpan: 1, component: ScholarshipWidget },
  { id: "lms", section: "학사", title: "LMS 과제·자료", icon: MonitorPlay, defaultOn: false, defaultSpan: 1, component: LmsWidget },
  { id: "loans", section: "도서관", title: "대출 현황", icon: BookOpen, defaultOn: false, defaultSpan: 1, component: LoansWidget },
  { id: "dorm", section: "캠퍼스", title: "기숙사 식단", icon: UtensilsCrossed, defaultOn: false, defaultSpan: 1, component: DormMealWidget },
  { id: "calendar", section: "캠퍼스", title: "학사일정", icon: CalendarDays, defaultOn: false, defaultSpan: 1, component: CalendarWidget },
];

export const WIDGET_MAP: ReadonlyMap<string, HomeWidgetDef> = new Map(
  WIDGET_REGISTRY.map((def) => [def.id, def]),
);

export const WIDGET_SECTIONS: HomeWidgetSection[] = ["오늘", "학사", "도서관", "캠퍼스"];
