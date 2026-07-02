"use client";

import { Search } from "lucide-react";
import { FormEvent } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibraryBookSearch } from "@/hooks/useLibraryBookSearch";
import type { BookStatus } from "@/lib/api/types";

function statusLabel(status: BookStatus) {
  if (status === "AVAILABLE") return { text: "대출가능", variant: "success" as const };
  if (status === "CHECKED_OUT") return { text: "대출중", variant: "secondary" as const };
  return { text: "알수없음", variant: "outline" as const };
}

function BookSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-control border border-hairline p-3">
          <Skeleton className="mb-1.5 h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function LibraryBookSearchCard() {
  const { query, setQuery, search, submittedQuery, data, error, isLoading } =
    useLibraryBookSearch();
  const errorState = getErrorStateDetails(error);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    search(query);
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>도서 검색</CardTitle>
        <CardDescription>중앙도서관 소장 도서 검색</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 저자 검색"
              aria-label="도서 검색어"
              className="rounded-pill pl-9"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-10 shrink-0 rounded-pill px-4"
            disabled={!query.trim()}
            aria-label="도서 검색"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        {isLoading && <BookSkeleton />}

        {errorState && (
          <ErrorState code={errorState.code} message={errorState.message} traceId={errorState.traceId} />
        )}

        {data && !errorState && (
          <>
            <p className="text-[11.5px] text-subtle">
              총 <span className="font-mono font-bold text-muted-foreground">{data.total}</span>건 중{" "}
              <span className="font-mono font-bold text-muted-foreground">{data.items.length}</span>건 표시
            </p>
            {data.items.length === 0 ? (
              <EmptyState
                icon={<Search className="h-6 w-6" aria-hidden="true" />}
                title="검색 결과가 없습니다"
                description={`"${submittedQuery}" 에 대한 결과가 없어요.`}
              />
            ) : (
              <ul className="space-y-2">
                {data.items.map((book) => {
                  const { text, variant } = statusLabel(book.status);
                  return (
                    <li
                      key={book.id}
                      className="rounded-control border border-hairline bg-surface p-3 shadow-e1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-bold leading-snug text-foreground">
                          {book.title}
                        </p>
                        <Badge variant={variant} className="shrink-0">
                          {text}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {book.author}
                        {book.location ? ` · ${book.location}` : ""}
                        {book.callNumber ? ` · ${book.callNumber}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
