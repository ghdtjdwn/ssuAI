"use client";

import { Newspaper } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotices } from "@/hooks/useNotices";

function NoticesSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="rounded-md border border-border p-3">
          <Skeleton className="mb-2 h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export function NoticesCard() {
  const { data, error, isLoading, refetch } = useNotices();
  const errorState = getErrorStateDetails(error);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>공지사항</CardTitle>
        <CardDescription>숭실대 최신 공지</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <ul className="space-y-2">
              {data.items.slice(0, 7).map((item) => (
                <li key={`${item.link}-${item.title}`} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 text-sm font-medium leading-snug text-foreground hover:underline"
                    >
                      {item.title}
                    </a>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {item.category}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.department} · {item.date}
                  </p>
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
