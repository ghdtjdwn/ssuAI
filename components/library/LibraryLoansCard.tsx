"use client";

import { BookOpen, LogIn } from "lucide-react";
import { useState } from "react";

import { LibraryLoginModal } from "@/components/library/LibraryLoginModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, getErrorStateDetails } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibraryLoans } from "@/hooks/useLibraryLoans";

function LoansSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-control border border-hairline p-3">
          <Skeleton className="mb-1.5 h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function LibraryLoansCard() {
  const { data, error, isLoading, refetch } = useLibraryLoans();
  const errorState = getErrorStateDetails(error);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const needsAuth = errorState?.code === "LIBRARY_SESSION_REQUIRED";

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>대출 현황</CardTitle>
          {data && !errorState ? (
            <span className="font-mono text-[13px] font-bold text-primary" aria-label={`대출 ${data.total}권`}>
              {data.total}권
            </span>
          ) : null}
        </div>
        <CardDescription>중앙도서관 현재 대출 도서</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <LoansSkeleton />}

        {needsAuth ? (
          <div className="flex flex-col items-start gap-3 rounded-control border border-dashed border-border bg-muted/40 p-4">
            <p className="text-[13px] text-muted-foreground">
              대출 현황은 도서관 연동이 필요합니다.
            </p>
            <Button size="sm" onClick={() => setShowLoginModal(true)}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              도서관 연동
            </Button>
          </div>
        ) : errorState ? (
          <ErrorState
            code={errorState.code}
            message={errorState.message}
            traceId={errorState.traceId}
            onRetry={() => void refetch()}
          />
        ) : null}

        {showLoginModal ? (
          <LibraryLoginModal onClose={() => setShowLoginModal(false)} />
        ) : null}

        {data && !errorState && (
          <>
            {data.loans.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
                title="대출 중인 도서가 없습니다"
                description="현재 도서관에서 빌린 책이 없어요."
              />
            ) : (
              <ul className="space-y-2">
                {data.loans.map((loan) => (
                  <li
                    key={loan.id}
                    className="rounded-control border border-hairline bg-surface p-3 shadow-e1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-bold leading-snug text-foreground">
                        {loan.title}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        {loan.isOverdue && <Badge variant="destructive">연체</Badge>}
                        {loan.isRenewable && <Badge variant="secondary">연장가능</Badge>}
                      </div>
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      반납기한 <span className="font-mono font-bold text-foreground">{loan.dueDate}</span>
                      {loan.author ? ` · ${loan.author}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
