"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, Send, ShieldAlert } from "lucide-react";

import { SaintLoginButton } from "@/components/auth/SaintLoginButton";
import {
  PolicyCaseDetails,
  PolicyCaseStatusBadge,
} from "@/components/copilot/PolicyCaseDetails";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import {
  createPolicyCase,
  getPolicyCase,
  listPolicyCases,
  type PolicyCase,
  type PolicyCategory,
} from "@/lib/api/copilot";
import { ApiError } from "@/lib/api/types";

const CATEGORIES: Array<{ value: PolicyCategory; label: string }> = [
  { value: "academic", label: "학사 정책 전체" },
  { value: "graduation", label: "졸업·학점" },
  { value: "scholarship", label: "장학" },
];

function errorDetails(error: unknown) {
  if (error instanceof ApiError) {
    return {
      code: error.code === "VALIDATION_FAILED" ? "POLICY_VALIDATION_FAILED" : error.code,
      message: error.message,
      traceId: error.traceId,
    };
  }
  return { code: "NETWORK_ERROR", message: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", traceId: "" };
}

function resultDescription(policyCase: PolicyCase) {
  switch (policyCase.status) {
    case "PENDING_REVIEW":
      return "지정 검토자 확인 전 초안입니다. 자동 게시되거나 개인별 행정 판단에 사용되지 않습니다.";
    case "IN_REVIEW":
      return "지정 검토자가 확인 중인 AI 초안입니다. 승인 전에는 자동 게시되지 않습니다.";
    case "APPROVED":
      return "지정 검토자가 근거를 확인해 승인한 최종 답변과 기존 AI 초안을 구분해 표시합니다.";
    case "REJECTED":
      return "지정 검토자가 반려한 AI 초안과 반려 사유입니다. 이 초안은 게시되지 않습니다.";
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function mergeRecentCases(incoming: PolicyCase[], current: PolicyCase[]) {
  const byId = new Map<number, PolicyCase>();
  for (const policyCase of [...incoming, ...current]) {
    const existing = byId.get(policyCase.id);
    if (!existing || policyCase.version > existing.version) byId.set(policyCase.id, policyCase);
  }
  return [...byId.values()]
    .sort((left, right) => {
      const createdDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return Number.isFinite(createdDifference) && createdDifference !== 0
        ? createdDifference
        : right.id - left.id;
    })
    .slice(0, 20);
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

function SignedOut() {
  return (
    <div className="mx-auto flex min-h-[58vh] max-w-lg items-center">
      <Card className="w-full text-center">
        <CardHeader>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-card bg-primary-soft text-primary-soft-foreground">
            <FileText size={24} aria-hidden />
          </span>
          <CardTitle className="mt-3">정책 Copilot은 로그인이 필요해요</CardTitle>
          <CardDescription>질문 제출과 검토 상태를 안전하게 처리하려면 u-SAINT로 로그인해 주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <SaintLoginButton label="SmartID 로그인" className="w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function PolicyCopilotSession({ accessToken }: { accessToken: string }) {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<PolicyCategory>("academic");
  const [policyCases, setPolicyCases] = useState<PolicyCase[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<{ code: string; message: string; traceId: string } | null>(null);
  const [historyError, setHistoryError] = useState<{ code: string; message: string; traceId: string } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestGenerationRef = useRef(0);
  const activeOperationRef = useRef<"submit" | "refresh" | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const historyGenerationRef = useRef(0);
  const historyControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestGenerationRef.current += 1;
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    activeOperationRef.current = null;
  }, []);

  const loadRecentCases = useCallback(async () => {
    const controller = new AbortController();
    const requestGeneration = historyGenerationRef.current + 1;
    historyGenerationRef.current = requestGeneration;
    historyControllerRef.current?.abort();
    historyControllerRef.current = controller;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const recentCases = await listPolicyCases(accessToken, controller.signal);
      if (historyGenerationRef.current !== requestGeneration) return;
      setPolicyCases((current) => mergeRecentCases(recentCases, current));
      setSelectedId((current) => current ?? recentCases[0]?.id ?? null);
    } catch (requestError) {
      if (historyGenerationRef.current === requestGeneration && !isAbortError(requestError)) {
        setHistoryError(errorDetails(requestError));
      }
    } finally {
      if (historyGenerationRef.current === requestGeneration) {
        historyControllerRef.current = null;
        setHistoryLoading(false);
      }
    }
  }, [accessToken]);

  useEffect(() => {
    const startTimer = window.setTimeout(() => void loadRecentCases(), 0);
    return () => {
      window.clearTimeout(startTimer);
      historyGenerationRef.current += 1;
      historyControllerRef.current?.abort();
      historyControllerRef.current = null;
    };
  }, [loadRecentCases]);

  const policyCase = policyCases.find((item) => item.id === selectedId) ?? policyCases[0] ?? null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeOperationRef.current) return;
    const trimmed = question.trim();
    if (trimmed.length < 10 || trimmed.length > 1000) {
      setError({
        code: "POLICY_QUESTION_INVALID",
        message: "질문은 10자 이상 1,000자 이하로 작성해 주세요.",
        traceId: "",
      });
      return;
    }
    const controller = new AbortController();
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;
    activeControllerRef.current = controller;
    activeOperationRef.current = "submit";
    setSubmitting(true);
    setError(null);
    try {
      const created = await createPolicyCase(
        accessToken,
        { question: trimmed, ...(category ? { category } : {}) },
        controller.signal,
      );
      if (requestGenerationRef.current === requestGeneration) {
        setPolicyCases((current) => mergeRecentCases([created], current));
        setSelectedId(created.id);
      }
    } catch (requestError) {
      if (requestGenerationRef.current === requestGeneration && !isAbortError(requestError)) {
        setError(errorDetails(requestError));
      }
    } finally {
      if (requestGenerationRef.current === requestGeneration) {
        activeControllerRef.current = null;
        activeOperationRef.current = null;
        setSubmitting(false);
      }
    }
  }

  async function refreshStatus() {
    if (!policyCase || activeOperationRef.current) return;
    const controller = new AbortController();
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;
    activeControllerRef.current = controller;
    activeOperationRef.current = "refresh";
    const caseId = policyCase.id;
    setRefreshing(true);
    setError(null);
    try {
      const refreshed = await getPolicyCase(accessToken, caseId, controller.signal);
      if (requestGenerationRef.current === requestGeneration) {
        setPolicyCases((current) => mergeRecentCases([refreshed], current));
      }
    } catch (requestError) {
      if (requestGenerationRef.current === requestGeneration && !isAbortError(requestError)) {
        setError(errorDetails(requestError));
      }
    } finally {
      if (requestGenerationRef.current === requestGeneration) {
        activeControllerRef.current = null;
        activeOperationRef.current = null;
        setRefreshing(false);
      }
    }
  }

  const busy = submitting || refreshing;

  return (
    <div className="mx-auto max-w-4xl animate-fadeUp space-y-4">
      <header className="rounded-card border border-primary/20 bg-primary-soft/40 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="text-[18px] font-extrabold text-foreground">공식 근거 기반 학사정책 답변 Copilot</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              공개 학칙·학사 안내의 근거를 찾아 답변 초안을 만듭니다. 개인 성적, 학번, 개인별 자격 판정은 이 화면에서 처리하지 않습니다.
            </p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>공개 정책 문의 제출</CardTitle>
          <CardDescription>제출된 AI 초안은 지정 검토자의 확인·승인 전에는 자동으로 게시되지 않습니다. 직원 검토 도입을 목표로 한 흐름입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit} noValidate>
            <div className="space-y-1.5">
              <label htmlFor="policy-category" className="text-[12px] font-bold text-foreground">분류</label>
              <select
                id="policy-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as PolicyCategory)}
                disabled={busy}
                className="h-10 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-foreground"
              >
                {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="policy-question" className="text-[12px] font-bold text-foreground">정책 질문</label>
              <textarea id="policy-question" value={question} onChange={(event) => setQuestion(event.target.value)} minLength={10} maxLength={1000} required rows={5} disabled={busy} aria-describedby="policy-question-help" placeholder="예: 복수전공 신청 시 필요한 이수 요건을 알려주세요." className="w-full rounded-control border border-border bg-surface p-3 text-[16px] leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring" />
              <p id="policy-question-help" className="text-[11.5px] text-subtle">{question.trim().length}/1,000자 · 공식 공개 규정 문의만 제출해 주세요.</p>
            </div>
            {error ? <ErrorState {...error} /> : null}
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              <Send size={16} aria-hidden />
              {submitting ? "초안 생성 요청 중…" : "근거 기반 초안 요청"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>내 최근 정책 요청</CardTitle>
            <CardDescription className="mt-1">현재 계정으로 제출한 최신 20건입니다. 항목을 선택해 검토 상태와 최종본을 다시 확인할 수 있습니다.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadRecentCases()}
            disabled={historyLoading}
            className="w-full sm:w-auto sm:shrink-0"
          >
            <RefreshCw size={14} aria-hidden />
            {historyLoading ? "목록 갱신 중…" : "최근 요청 새로고침"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyError ? (
            <ErrorState
              {...historyError}
              onRetry={() => void loadRecentCases()}
              retryLabel="최근 요청 다시 불러오기"
            />
          ) : null}
          {historyLoading && policyCases.length === 0 ? (
            <p role="status" aria-live="polite" className="rounded-control border border-dashed border-hairline p-4 text-center text-[12px] text-subtle">
              최근 요청을 불러오는 중…
            </p>
          ) : null}
          {!historyLoading && !historyError && policyCases.length === 0 ? (
            <p className="rounded-control border border-dashed border-hairline p-4 text-center text-[12px] text-subtle">
              아직 제출한 정책 요청이 없습니다.
            </p>
          ) : null}
          {policyCases.length > 0 ? (
            <ul aria-label="최근 정책 요청" className="grid gap-2 sm:grid-cols-2">
              {policyCases.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={policyCase?.id === item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setError(null);
                    }}
                    className={`w-full rounded-control border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${policyCase?.id === item.id ? "border-primary bg-primary-soft/45" : "border-hairline hover:bg-muted"}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-[12.5px] font-bold text-foreground">{item.question}</span>
                      <PolicyCaseStatusBadge status={item.status} />
                    </span>
                    <time dateTime={item.createdAt} className="mt-2 block text-[11px] text-subtle">
                      {formatCreatedAt(item.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {historyLoading && policyCases.length > 0 ? (
            <p role="status" aria-live="polite" className="text-[11px] text-subtle">최신 목록을 확인하고 있습니다.</p>
          ) : null}
        </CardContent>
      </Card>

      <div aria-live="polite" aria-atomic="true">
        {policyCase ? (
          <Card>
            <CardHeader>
              <CardTitle>선택한 요청 결과</CardTitle>
              <CardDescription>{resultDescription(policyCase)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PolicyCaseDetails policyCase={policyCase} />
              <Button
                type="button"
                variant="outline"
                onClick={() => void refreshStatus()}
                disabled={busy}
              >
                <RefreshCw size={16} aria-hidden />
                {refreshing ? "검토 상태 확인 중…" : "검토 상태 새로고침"}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export function PolicyCopilotView() {
  const { accessToken, isAuthenticated, isLoading, user } = useSaintAuth();
  const principal = isAuthenticated ? user?.studentId ?? null : null;

  if (isLoading) return <p className="py-12 text-center text-sm text-subtle">인증 확인 중…</p>;
  if (!isAuthenticated || !accessToken || !principal) return <SignedOut />;

  // The keyed session makes every local field belong to exactly one authenticated
  // principal. An account switch unmounts the old session before the new one renders.
  return <PolicyCopilotSession key={principal} accessToken={accessToken} />;
}
