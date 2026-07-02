"use client";

import { Building2, Search, SearchX } from "lucide-react";
import { useEffect, useState } from "react";

import { FacilityResultItem } from "@/components/facility/FacilityResultItem";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFacilitySearch } from "@/hooks/useFacilitySearch";
import { normalizeSearchQuery } from "@/lib/utils";

const MAX_QUERY_LENGTH = 64;

function FacilitySkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-24 w-full rounded-[12px]" />
      <Skeleton className="h-24 w-full rounded-[12px]" />
      <Skeleton className="h-24 w-full rounded-[12px]" />
    </div>
  );
}

export function FacilitySearchCard() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const normalizedQuery = normalizeSearchQuery(debouncedQuery);
  const { data, error, isFetching, refetch } = useFacilitySearch(normalizedQuery);
  const errorState = getErrorStateDetails(error);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <Card className="h-full animate-fadeUp">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 size={18} className="shrink-0 text-primary" aria-hidden="true" />
          <CardTitle>시설 검색</CardTitle>
        </div>
        <span className="shrink-0 text-[11.5px] text-subtle">식당 · 카페 · 매점 · 출력소</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="시설 이름, 별칭, 위치로 검색"
            className="h-11 rounded-pill pl-10 pr-4 shadow-e1"
            maxLength={MAX_QUERY_LENGTH}
            aria-label="시설 검색어"
          />
        </div>

        {!normalizedQuery ? (
          <EmptyState
            icon={<Search className="h-6 w-6" aria-hidden="true" />}
            title="검색어를 입력하세요"
            description="시설 이름, 별칭, 위치로 검색할 수 있습니다."
          />
        ) : null}

        {normalizedQuery && isFetching && !data ? <FacilitySkeleton /> : null}

        {errorState ? (
          <ErrorState
            code={errorState.code}
            message={errorState.message}
            traceId={errorState.traceId}
            onRetry={() => void refetch()}
          />
        ) : null}

        {normalizedQuery && data && data.facilities.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
            title="검색 결과가 없습니다"
            description="다른 검색어를 입력해보세요."
          />
        ) : null}

        {normalizedQuery && data && data.facilities.length > 0 ? (
          <div className="space-y-2.5">
            {data.facilities.map((facility) => (
              <FacilityResultItem key={facility.id} facility={facility} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
