"use client";

import { useState } from "react";

import { Megaphone, Newspaper } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotices } from "@/hooks/useNotices";
import { cn } from "@/lib/utils";

/**
 * Category slugs the notices API accepts (`GET /api/notices?category=`),
 * matching the backend's known category list. Empty value = no filter (전체);
 * filtering happens server-side via the query param.
 */
const NOTICE_CATEGORIES = [
  { value: "", label: "전체" },
  { value: "채용", label: "채용" },
  { value: "학사", label: "학사" },
  { value: "장학", label: "장학" },
  { value: "봉사", label: "봉사" },
  { value: "기타", label: "기타" },
] as const;

function categoryBadgeVariant(category: string): BadgeProps["variant"] {
  switch (category) {
    case "학사":
      return "default";
    case "장학":
      return "mint";
    case "채용":
    case "교원채용":
      return "warning";
    case "봉사":
      return "success";
    default:
      return "secondary";
  }
}

function NoticesSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="space-y-2 border-b border-hairline pb-2.5 last:border-0 last:pb-0">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export function NoticesCard() {
  const [category, setCategory] = useState("");
  const { data, error, isLoading, refetch } = useNotices(category ? { category } : undefined);
  const errorState = getErrorStateDetails(error);

  return (
    <Card className="h-full animate-fadeUp">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Megaphone size={18} className="shrink-0 text-primary" aria-hidden="true" />
          <CardTitle>공지사항</CardTitle>
        </div>
        <span className="shrink-0 text-[11.5px] text-subtle">숭실대 최신 공지</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="공지 카테고리 필터">
          {NOTICE_CATEGORIES.map((item) => {
            const active = item.value === category;
            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(item.value)}
                className={cn(
                  "press h-7 rounded-pill border px-3 text-[11.5px] font-semibold transition-colors",
                  active
                    ? "border-transparent bg-primary text-primary-foreground shadow-e1"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {isLoading && <NoticesSkeleton />}

        {errorState ? (
          <ErrorState
            code={errorState.code}
            message={errorState.message}
            traceId={errorState.traceId}
            onRetry={() => void refetch()}
          />
        ) : null}

        {data && !errorState && (
          data.items.length === 0 ? (
            <EmptyState
              icon={<Newspaper className="h-6 w-6" aria-hidden="true" />}
              title="공지사항이 없습니다"
              description="현재 확인할 수 있는 공지가 없어요."
            />
          ) : (
            <ul>
              {data.items.slice(0, 7).map((item) => (
                <li
                  key={`${item.link}-${item.title}`}
                  className="border-b border-hairline py-2.5 first:pt-0 last:border-0 last:pb-0"
                >
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium leading-snug text-foreground group-hover:underline">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-[11px] text-subtle">
                        {item.department} · <span className="font-mono">{item.date}</span>
                      </span>
                    </span>
                    <Badge variant={categoryBadgeVariant(item.category)} className="shrink-0">
                      {item.category}
                    </Badge>
                  </a>
                </li>
              ))}
            </ul>
          )
        )}

        <Button asChild variant="ghost" size="sm">
          <a
            href="https://ssu.ac.kr/ssu/main/notice.do"
            target="_blank"
            rel="noopener noreferrer"
          >
            공지사항 더보기
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
