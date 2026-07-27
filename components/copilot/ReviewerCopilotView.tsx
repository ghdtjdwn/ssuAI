"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, RefreshCw, X } from "lucide-react";

import { SaintLoginButton } from "@/components/auth/SaintLoginButton";
import { PolicyCaseDetails, PolicyCaseStatusBadge, ReasonBadges } from "@/components/copilot/PolicyCaseDetails";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import {
  claimReviewerPolicyCase,
  decideReviewerPolicyCase,
  getReviewerPolicyCaseMetrics,
  listReviewerPolicyCases,
  type PolicyCase,
  type PolicyCaseMetrics,
  type PolicyCaseStatus,
} from "@/lib/api/copilot";
import { ApiError } from "@/lib/api/types";

type UiError = {
  code: string;
  message: string;
  traceId: string;
  conflict?: boolean;
  forbidden?: boolean;
};
const EMPTY_CASES: PolicyCase[] = [];
const POLICY_REVIEW_KEY = ["policy-review"] as const;
const REVIEW_QUEUE_STALE_MS = 15_000;
const REVIEWER_CASE_DETAIL_ID = "reviewer-policy-case-detail";

const FILTERS: Array<{ value: "" | PolicyCaseStatus; label: string }> = [
  { value: "", label: "전체" },
  { value: "PENDING_REVIEW", label: "검토 대기" },
  { value: "IN_REVIEW", label: "검토 중" },
  { value: "APPROVED", label: "승인됨" },
  { value: "REJECTED", label: "반려됨" },
];

function toError(error: unknown): UiError {
  if (error instanceof ApiError) {
    if (error.httpStatus === 409) {
      return {
        code: error.code,
        message: "선점 기한이 만료되었거나 다른 검토자가 먼저 변경했습니다. 최신 사례를 다시 불러와 확인해 주세요.",
        traceId: error.traceId,
        conflict: true,
      };
    }
    if (error.httpStatus === 403) {
      return {
        code: error.code,
        message: "이 화면은 백엔드에서 권한을 받은 검토자만 사용할 수 있습니다.",
        traceId: error.traceId,
        forbidden: true,
      };
    }
    return {
      code: error.code === "VALIDATION_FAILED" ? "POLICY_VALIDATION_FAILED" : error.code,
      message: error.message,
      traceId: error.traceId,
    };
  }
  return { code: "NETWORK_ERROR", message: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", traceId: "" };
}

function reviewerSessionKey(principal: string) {
  return [...POLICY_REVIEW_KEY, principal] as const;
}

function reviewerCasesKey(principal: string, filter: "" | PolicyCaseStatus) {
  return [...reviewerSessionKey(principal), "cases", filter || "ALL"] as const;
}

function reviewerCasesPrefix(principal: string) {
  return [...reviewerSessionKey(principal), "cases"] as const;
}

function reviewerMetricsKey(principal: string) {
  return [...reviewerSessionKey(principal), "metrics"] as const;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function formatLeaseExpiry(expiresAt: string | null) {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ko-KR");
}

function formatPercent(value: number | null, sampleSize: number) {
  if (value === null || sampleSize === 0) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(value: number | null, sampleSize: number) {
  if (value === null || sampleSize === 0) return "—";
  if (value < 1_000) return `${Math.round(value)}ms`;
  return `${(value / 1_000).toFixed(1)}초`;
}

export function MetricsCards({ metrics }: { metrics: PolicyCaseMetrics | null }) {
  const total = metrics?.totalCases ?? 0;
  const decided = metrics ? metrics.approvedCases + metrics.rejectedCases : 0;
  const approved = metrics?.approvedCases ?? 0;
  const cards = [
    ["총 사례", metrics ? `${metrics.totalCases}건` : "—"],
    ["대기 / 검토 중", metrics ? `${metrics.pendingCases}건 / ${metrics.inReviewCases}건` : "—"],
    ["승인 / 반려", metrics ? `${metrics.approvedCases}건 / ${metrics.rejectedCases}건` : "—"],
    ["승인율", metrics ? formatPercent(metrics.approvalRate, decided) : "—"],
    ["무수정 승인율", metrics ? formatPercent(metrics.unchangedApprovalRate, approved) : "—"],
    ["수정률", metrics ? formatPercent(metrics.correctionRate, approved) : "—"],
    ["근거 포함률", metrics ? formatPercent(metrics.citationCoverageRate, total) : "—"],
    ["안전 보류율", metrics ? formatPercent(metrics.safeHoldRate, total) : "—"],
    [
      "평균 초안 / 검토",
      metrics
        ? `${formatDuration(metrics.averageDraftLatencyMs, total)} / ${formatDuration(metrics.averageReviewDurationMs, decided)}`
        : "—",
    ],
  ];
  return (
    <section aria-labelledby="policy-metrics-title" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="policy-metrics-title" className="text-[15px] font-extrabold text-foreground">운영 측정값</h2>
        <p className="text-[11px] text-subtle">0건 또는 사례 없음은 성과가 아니라 아직 집계할 사례가 없다는 뜻입니다.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label} className="shadow-none"><CardContent className="p-3"><p className="text-[11px] font-bold text-subtle">{label}</p><p className="mt-1 text-[16px] font-extrabold text-foreground">{value}</p></CardContent></Card>
        ))}
      </div>
    </section>
  );
}

function ReviewDecisionEditor({
  policyCase,
  disabled,
  onDecide,
}: {
  policyCase: PolicyCase;
  disabled: boolean;
  onDecide: (decision: "APPROVE" | "REJECT", finalAnswer: string, rejectionReason: string) => void;
}) {
  const [finalAnswer, setFinalAnswer] = useState(policyCase.finalAnswer ?? policyCase.aiDraft ?? "");
  const [rejectionReason, setRejectionReason] = useState("");

  return (
    <div className="space-y-4 border-t border-hairline pt-4">
      <div className="space-y-2">
        <label className="block text-[12px] font-bold" htmlFor="final-answer">
          최종 답변
          <textarea
            id="final-answer"
            value={finalAnswer}
            onChange={(event) => setFinalAnswer(event.target.value)}
            rows={6}
            maxLength={10_000}
            className="mt-1.5 w-full rounded-control border border-border bg-surface p-3 text-[16px] font-normal leading-relaxed"
          />
        </label>
        <Button
          type="button"
          onClick={() => onDecide("APPROVE", finalAnswer, rejectionReason)}
          disabled={disabled}
        >
          <Check size={16} aria-hidden />
          편집 내용 승인
        </Button>
      </div>
      <div className="space-y-2 border-t border-hairline pt-4">
        <label className="block text-[12px] font-bold" htmlFor="rejection-reason">
          반려 사유
          <textarea
            id="rejection-reason"
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            rows={3}
            maxLength={4_000}
            className="mt-1.5 w-full rounded-control border border-border bg-surface p-3 text-[16px] font-normal"
            placeholder="예: 적용 조항의 개정 검증이 필요합니다."
          />
        </label>
        <Button
          type="button"
          variant="destructive"
          onClick={() => onDecide("REJECT", finalAnswer, rejectionReason)}
          disabled={disabled}
        >
          <X size={16} aria-hidden />
          반려
        </Button>
      </div>
    </div>
  );
}

function ReviewerCopilotSession({
  accessToken,
  principal,
}: {
  accessToken: string;
  principal: string;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"" | PolicyCaseStatus>("PENDING_REVIEW");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<UiError | null>(null);
  const [metricsRefreshError, setMetricsRefreshError] = useState<UiError | null>(null);
  const [accessDenied, setAccessDenied] = useState<UiError | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const actionGenerationRef = useRef(0);
  const actionControllerRef = useRef<AbortController | null>(null);
  const actionInFlightRef = useRef(false);
  const accessDeniedRef = useRef(false);

  useEffect(() => () => {
    actionGenerationRef.current += 1;
    actionControllerRef.current?.abort();
    actionControllerRef.current = null;
    actionInFlightRef.current = false;
  }, []);

  const lockReviewerSession = useCallback((error: UiError) => {
    if (!error.forbidden) return false;
    if (!accessDeniedRef.current) {
      accessDeniedRef.current = true;
      actionGenerationRef.current += 1;
      actionControllerRef.current?.abort();
      actionControllerRef.current = null;
      actionInFlightRef.current = false;
      setActionLoading(false);
      setActionError(null);
      setMetricsRefreshError(null);
      setAccessDenied(error);

      const sessionKey = reviewerSessionKey(principal);
      void queryClient.cancelQueries({ queryKey: sessionKey });
      queryClient.removeQueries({ queryKey: sessionKey });
    }
    return true;
  }, [principal, queryClient]);

  const casesKey = reviewerCasesKey(principal, filter);
  const metricsKey = reviewerMetricsKey(principal);
  const casesQuery = useQuery({
    queryKey: casesKey,
    queryFn: ({ signal }) => listReviewerPolicyCases(accessToken, filter || undefined, signal),
    retry: false,
    staleTime: REVIEW_QUEUE_STALE_MS,
    enabled: !accessDenied,
  });
  const metricsQuery = useQuery({
    queryKey: metricsKey,
    queryFn: ({ signal }) => getReviewerPolicyCaseMetrics(accessToken, signal),
    retry: false,
    staleTime: REVIEW_QUEUE_STALE_MS,
    enabled: !accessDenied,
  });

  useEffect(() => {
    for (const queryError of [casesQuery.error, metricsQuery.error]) {
      if (queryError && lockReviewerSession(toError(queryError))) return;
    }
  }, [casesQuery.error, lockReviewerSession, metricsQuery.error]);

  const casesError = casesQuery.error ? toError(casesQuery.error) : null;
  const queriedMetricsError = metricsQuery.error ? toError(metricsQuery.error) : null;
  const queryDenied = casesError?.forbidden
    ? casesError
    : queriedMetricsError?.forbidden
      ? queriedMetricsError
      : null;
  const denied = accessDenied ?? queryDenied;
  const cases = denied ? EMPTY_CASES : casesQuery.data ?? EMPTY_CASES;
  const metrics = denied ? null : metricsQuery.data ?? null;
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0] ?? null;
  const error = denied ?? actionError ?? casesError;
  const rawMetricsError = metricsRefreshError ?? queriedMetricsError;
  const metricsError = !denied && rawMetricsError && !rawMetricsError.forbidden
    ? {
        ...rawMetricsError,
        code: "POLICY_METRICS_UNAVAILABLE",
        message: `운영 측정값을 불러오지 못했습니다. 검토 큐와 결정 기능은 계속 사용할 수 있습니다. ${rawMetricsError.message}`,
      }
    : null;
  const loading = !denied && (casesQuery.isLoading || casesQuery.isFetching);

  async function fetchCases(nextFilter: "" | PolicyCaseStatus) {
    const nextKey = reviewerCasesKey(principal, nextFilter);
    return queryClient.fetchQuery({
      queryKey: nextKey,
      queryFn: ({ signal }) => listReviewerPolicyCases(
        accessToken,
        nextFilter || undefined,
        signal,
      ),
      staleTime: REVIEW_QUEUE_STALE_MS,
    });
  }

  async function refreshMetrics(expectedActionGeneration?: number) {
    if (accessDeniedRef.current) return;
    setMetricsRefreshError(null);
    await queryClient.invalidateQueries({
      queryKey: metricsKey,
      exact: true,
      refetchType: "none",
    });
    try {
      await queryClient.fetchQuery({
        queryKey: metricsKey,
        queryFn: ({ signal }) => getReviewerPolicyCaseMetrics(accessToken, signal),
        staleTime: REVIEW_QUEUE_STALE_MS,
      });
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      if (
        expectedActionGeneration !== undefined
        && actionGenerationRef.current !== expectedActionGeneration
      ) return;
      const nextError = toError(requestError);
      if (!lockReviewerSession(nextError)) setMetricsRefreshError(nextError);
    }
  }

  async function refreshQueue() {
    if (accessDeniedRef.current) return;
    setActionError(null);
    await queryClient.invalidateQueries({
      queryKey: casesKey,
      exact: true,
      refetchType: "none",
    });
    try {
      await fetchCases(filter);
    } catch (requestError) {
      if (isAbortError(requestError)) return;
      const nextError = toError(requestError);
      if (!lockReviewerSession(nextError)) setActionError(nextError);
    }
  }

  async function claim() {
    if (!selected || accessDeniedRef.current || actionInFlightRef.current) return;
    const controller = new AbortController();
    const actionGeneration = actionGenerationRef.current + 1;
    actionGenerationRef.current = actionGeneration;
    actionControllerRef.current = controller;
    actionInFlightRef.current = true;
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await claimReviewerPolicyCase(accessToken, selected.id, controller.signal);
      if (actionGenerationRef.current !== actionGeneration) return;

      const nextFilter: PolicyCaseStatus = "IN_REVIEW";
      await queryClient.invalidateQueries({
        queryKey: reviewerCasesPrefix(principal),
        refetchType: "none",
      });
      await fetchCases(nextFilter);
      if (actionGenerationRef.current !== actionGeneration) return;

      setSelectedId(updated.id);
      setFilter(nextFilter);
      setActionError(null);
      void refreshMetrics(actionGeneration);
    } catch (requestError) {
      if (actionGenerationRef.current === actionGeneration && !isAbortError(requestError)) {
        const nextError = toError(requestError);
        if (!lockReviewerSession(nextError)) setActionError(nextError);
      }
    } finally {
      if (actionGenerationRef.current === actionGeneration) {
        actionControllerRef.current = null;
        actionInFlightRef.current = false;
        setActionLoading(false);
      }
    }
  }

  async function decide(
    decision: "APPROVE" | "REJECT",
    finalAnswer: string,
    rejectionReason: string,
  ) {
    if (!selected || accessDeniedRef.current || actionInFlightRef.current) return;
    if (decision === "APPROVE" && !finalAnswer.trim()) {
      setActionError({ code: "POLICY_FINAL_ANSWER_REQUIRED", message: "승인할 최종 답변을 입력해 주세요.", traceId: "" });
      return;
    }
    if (decision === "REJECT" && !rejectionReason.trim()) {
      setActionError({ code: "POLICY_REJECTION_REASON_REQUIRED", message: "반려 사유를 입력해 주세요.", traceId: "" });
      return;
    }
    const controller = new AbortController();
    const actionGeneration = actionGenerationRef.current + 1;
    actionGenerationRef.current = actionGeneration;
    actionControllerRef.current = controller;
    actionInFlightRef.current = true;
    setActionLoading(true);
    setActionError(null);
    try {
      await decideReviewerPolicyCase(accessToken, selected.id, {
        expectedVersion: selected.version,
        decision,
        ...(decision === "APPROVE" ? { finalAnswer: finalAnswer.trim() } : { rejectionReason: rejectionReason.trim() }),
      }, controller.signal);
      if (actionGenerationRef.current !== actionGeneration) return;
      setActionError(null);
      await queryClient.invalidateQueries({
        queryKey: reviewerCasesPrefix(principal),
        refetchType: "none",
      });
      await fetchCases(filter);
      if (actionGenerationRef.current !== actionGeneration) return;
      void refreshMetrics(actionGeneration);
    } catch (requestError) {
      if (actionGenerationRef.current === actionGeneration && !isAbortError(requestError)) {
        const nextError = toError(requestError);
        if (!lockReviewerSession(nextError)) setActionError(nextError);
      }
    } finally {
      if (actionGenerationRef.current === actionGeneration) {
        actionControllerRef.current = null;
        actionInFlightRef.current = false;
        setActionLoading(false);
      }
    }
  }

  return (
    <div className="animate-fadeUp space-y-5">
      <header className="rounded-card border border-primary/20 bg-primary-soft/40 p-5">
        <div className="flex gap-3"><ClipboardCheck className="mt-0.5 shrink-0 text-primary" aria-hidden /><div><h2 className="text-[18px] font-extrabold">공식 정책 답변 검토</h2><p className="mt-1 text-[13px] text-muted-foreground">AI 초안은 검토자가 승인하기 전 자동 게시되지 않습니다. 실제 권한은 서버가 deny-by-default로 확인합니다.</p></div></div>
      </header>
      {error ? <ErrorState {...error} onRetry={error.conflict ? () => void refreshQueue() : undefined} retryLabel="최신 사례 불러오기" /> : null}
      {metricsError ? <ErrorState {...metricsError} onRetry={() => void refreshMetrics()} retryLabel="측정값 다시 불러오기" /> : null}
      <MetricsCards metrics={metrics} />
      <section className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)]">
        <Card>
          <CardHeader className="space-y-3"><CardTitle>검토 큐</CardTitle><label className="text-[12px] font-bold" htmlFor="case-filter">상태 필터<select id="case-filter" value={filter} onChange={(event) => { setSelectedId(null); setActionError(null); setFilter(event.target.value as "" | PolicyCaseStatus); }} disabled={Boolean(denied)} className="mt-1 h-9 w-full rounded-control border border-border bg-surface px-2 text-[13px]">{FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><Button type="button" variant="outline" size="sm" onClick={() => void refreshQueue()} disabled={Boolean(denied) || loading}><RefreshCw size={14} aria-hidden />{loading ? "불러오는 중" : "새로고침"}</Button></CardHeader>
          <CardContent className="space-y-2">
            {cases.length ? cases.map((policyCase) => <button key={policyCase.id} type="button" onClick={() => { setSelectedId(policyCase.id); setActionError(null); }} disabled={Boolean(denied)} aria-pressed={selected?.id === policyCase.id} aria-controls={REVIEWER_CASE_DETAIL_ID} className={`w-full rounded-control border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.id === policyCase.id ? "border-primary bg-primary-soft/45" : "border-hairline hover:bg-muted"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-[12.5px] font-bold">{policyCase.question}</span><PolicyCaseStatusBadge status={policyCase.status} /></div><div className="mt-2"><ReasonBadges reasons={policyCase.reviewReasonCodes} /></div></button>) : <p className="rounded-control border border-dashed border-hairline p-4 text-center text-[12px] text-subtle">{loading ? "검토 사례를 불러오는 중…" : "표시할 사례가 없습니다."}</p>}
          </CardContent>
        </Card>
        <Card id={REVIEWER_CASE_DETAIL_ID}>
          <CardHeader><CardTitle>검토 및 결정</CardTitle><CardDescription>승인 시 편집한 최종 답변이 저장됩니다. 반려는 사유를 남겨 재검토 근거로 사용합니다.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {selected ? <><PolicyCaseDetails policyCase={selected} reviewer />
              {selected.status === "PENDING_REVIEW" ? <Button type="button" variant="outline" onClick={() => void claim()} disabled={Boolean(denied) || actionLoading}>이 사례 검토 시작</Button> : null}
              {selected.status === "IN_REVIEW" && selected.claimedByCurrentReviewer ? <>
                {formatLeaseExpiry(selected.claimExpiresAt) ? <p className="rounded-control bg-muted px-3 py-2 text-[12px] text-muted-foreground">서버 응답의 선점 만료 시각(정보용): <time dateTime={selected.claimExpiresAt ?? undefined}>{formatLeaseExpiry(selected.claimExpiresAt)}</time></p> : null}
                <ReviewDecisionEditor key={`${selected.id}:${selected.version}`} policyCase={selected} disabled={Boolean(denied) || actionLoading} onDecide={(decision, finalAnswer, rejectionReason) => void decide(decision, finalAnswer, rejectionReason)} />
              </> : null}
              {selected.status === "IN_REVIEW" && !selected.claimedByCurrentReviewer ? <div role="status" className="space-y-3 rounded-control border border-warning/30 bg-warning-bg px-4 py-3 text-[12.5px] text-warning">
                <p>현재 서버 응답 기준으로 이 사례의 결정 권한이 없습니다. 검토자 신원은 표시하지 않으며, 다시 선점할 수 있는지는 서버가 판단합니다.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void claim()} disabled={Boolean(denied) || loading || actionLoading}>이 사례 다시 선점</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void refreshQueue()} disabled={Boolean(denied) || loading || actionLoading}><RefreshCw size={14} aria-hidden />최신 선점 상태 불러오기</Button>
                </div>
              </div> : null}
            </> : <p className="rounded-control border border-dashed border-hairline p-8 text-center text-sm text-subtle">왼쪽 큐에서 사례를 선택해 주세요.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function ReviewerCopilotView() {
  const { accessToken, isAuthenticated, isLoading, user } = useSaintAuth();
  const queryClient = useQueryClient();
  const principal = isAuthenticated ? user?.studentId ?? null : null;
  const previousPrincipalRef = useRef(principal);

  useEffect(() => {
    const previousPrincipal = previousPrincipalRef.current;
    if (previousPrincipal && previousPrincipal !== principal) {
      const previousKey = reviewerSessionKey(previousPrincipal);
      void queryClient.cancelQueries({ queryKey: previousKey });
      queryClient.removeQueries({ queryKey: previousKey });
    }
    if (!principal && previousPrincipal) {
      void queryClient.cancelQueries({ queryKey: POLICY_REVIEW_KEY });
      queryClient.removeQueries({ queryKey: POLICY_REVIEW_KEY });
    }
    previousPrincipalRef.current = principal;
  }, [principal, queryClient]);

  if (isLoading) return <p className="py-12 text-center text-sm text-subtle">인증 확인 중…</p>;
  if (!isAuthenticated || !accessToken || !principal) return <div className="mx-auto max-w-md py-16 text-center"><h2 className="text-lg font-extrabold">검토자 로그인이 필요합니다</h2><p className="mt-2 text-sm text-muted-foreground">권한은 서버에서 확인합니다.</p><SaintLoginButton label="SmartID 로그인" className="mt-5" /></div>;

  return <ReviewerCopilotSession key={principal} accessToken={accessToken} principal={principal} />;
}
