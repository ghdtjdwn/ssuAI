import { CheckCircle2, ExternalLink, FileWarning, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  PolicyCase,
  PolicyCategory,
  PolicyCitation,
  PolicyReviewReasonCode,
} from "@/lib/api/copilot";

const statusLabels: Record<PolicyCase["status"], string> = {
  PENDING_REVIEW: "검토 대기",
  IN_REVIEW: "검토 중",
  APPROVED: "승인됨",
  REJECTED: "반려됨",
};

const statusVariants: Record<PolicyCase["status"], "warning" | "default" | "success" | "destructive"> = {
  PENDING_REVIEW: "warning",
  IN_REVIEW: "default",
  APPROVED: "success",
  REJECTED: "destructive",
};

const categoryLabels: Record<PolicyCategory, string> = {
  academic: "학사 정책",
  graduation: "졸업·학점",
  scholarship: "장학",
};

const reasonLabels: Record<PolicyReviewReasonCode, string> = {
  NO_EVIDENCE: "공식 근거 없음",
  FALLBACK_SOURCE: "대체 근거 사용",
  REVISION_UNVERIFIED: "개정 검증 필요",
  UNRESOLVED_CONDITION: "추가 확인 조건 있음",
  DRAFT_GENERATION_FAILED: "초안 생성 실패 — 직접 작성 필요",
};

const sourceOriginLabels: Record<string, string> = {
  LIVE: "실시간 공식 근거",
  MIXED: "혼합 근거",
  SEED: "내장 기준 근거",
};

function formatDate(value: string | null) {
  if (!value) return "확인일 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ko-KR");
}

function safeOfficialCitationUrl(candidate: string) {
  try {
    const parsed = new URL(candidate);
    const officialHost = parsed.hostname === "ssu.ac.kr" || parsed.hostname.endsWith(".ssu.ac.kr");
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !officialHost) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function CitationList({ citations }: { citations: PolicyCitation[] }) {
  if (!citations.length) {
    return (
      <p className="rounded-control border border-warning/30 bg-warning-bg px-3 py-2 text-[12px] text-warning">
        연결된 공식 근거가 없습니다. 자동 답변을 게시하지 않고 검토 대상으로 유지합니다.
      </p>
    );
  }

  return (
    <ul className="space-y-2" aria-label="공식 근거">
      {citations.map((citation) => {
        const safeUrl = safeOfficialCitationUrl(citation.url);
        return <li key={citation.sourceId} className="rounded-control border border-hairline bg-muted/35 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {safeUrl ? (
              <a
                className="inline-flex min-w-0 items-center gap-1 text-[13px] font-bold text-primary underline-offset-2 hover:underline"
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${citation.title} (새 탭에서 열림)`}
              >
                <span className="truncate">{citation.title}</span>
                <ExternalLink size={13} aria-hidden />
              </a>
            ) : (
              <span className="min-w-0 truncate text-[13px] font-bold text-foreground">{citation.title}</span>
            )}
            <Badge variant={citation.revisionVerified ? "success" : "warning"}>
              {citation.revisionVerified ? "개정 검증" : "개정 확인 필요"}
            </Badge>
            {!safeUrl ? <Badge variant="warning">공식 링크 확인 필요</Badge> : null}
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {citation.heading ? `${citation.heading} · ` : ""}
            {citation.revision ? `개정 ${citation.revision} · ` : ""}
            시행 {formatDate(citation.effectiveDate)} · 최종 검증 {formatDate(citation.lastVerifiedDate)}
          </p>
        </li>;
      })}
    </ul>
  );
}

export function ReasonBadges({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="검토 사유">
      {reasons.map((reason) => (
        <Badge key={reason} variant="warning">
          <FileWarning size={12} aria-hidden />
          {reasonLabels[reason as PolicyReviewReasonCode] ?? `확인 필요: ${reason}`}
        </Badge>
      ))}
    </div>
  );
}

export function PolicyCaseStatusBadge({ status }: { status: PolicyCase["status"] }) {
  return <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>;
}

export function PolicyCaseDetails({ policyCase, reviewer = false }: { policyCase: PolicyCase; reviewer?: boolean }) {
  const isFinal = policyCase.status === "APPROVED";
  const isRejected = policyCase.status === "REJECTED";
  const draftLabel = reviewer || isFinal || isRejected
    ? "AI 초안"
    : policyCase.status === "IN_REVIEW"
      ? "AI 초안 — 지정 검토자 확인 중"
      : "AI 초안 — 지정 검토자 확인 전";
  return (
    <section className="space-y-4" aria-label="정책 답변 상세">
      <div className="flex flex-wrap items-center gap-2">
        <PolicyCaseStatusBadge status={policyCase.status} />
        {policyCase.category ? <Badge variant="secondary">{categoryLabels[policyCase.category]}</Badge> : null}
        {policyCase.sourceOrigin ? (
          <Badge variant="outline">
            {sourceOriginLabels[policyCase.sourceOrigin] ?? `근거 출처: ${policyCase.sourceOrigin}`}
          </Badge>
        ) : null}
      </div>
      <div>
        <p className="text-[11.5px] font-bold text-subtle">질문</p>
        <p className="mt-1 whitespace-pre-wrap text-[14px] font-semibold leading-relaxed text-foreground">
          {policyCase.question}
        </p>
      </div>
      <div className="rounded-control border border-primary/20 bg-primary-soft/45 p-4">
        <div className="flex items-center gap-2 text-[12px] font-bold text-primary-soft-foreground">
          <ShieldCheck size={16} aria-hidden />
          {draftLabel}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
          {policyCase.aiDraft || "AI 초안이 생성되지 않았습니다. 검토자가 직접 안내할 수 있습니다."}
        </p>
      </div>
      {isFinal ? (
        <div className="rounded-control border border-success/30 bg-success-bg/50 p-4">
          <p className="text-[12px] font-bold text-success">지정 검토자 승인 최종본</p>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
            {policyCase.finalAnswer || "승인된 최종 답변이 기록되지 않았습니다."}
          </p>
        </div>
      ) : null}
      {isRejected ? (
        <div className="rounded-control border border-danger/25 bg-danger-bg/45 p-4">
          <p className="text-[12px] font-bold text-danger">반려됨</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
            {policyCase.rejectionReason || "반려 사유가 기록되지 않았습니다."}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">이 AI 초안은 게시되지 않습니다.</p>
        </div>
      ) : null}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[12px] font-bold text-foreground">
          <CheckCircle2 size={16} className="text-primary" aria-hidden />
          공식 근거 및 개정 상태
        </div>
        <CitationList citations={policyCase.citations} />
      </div>
      {policyCase.reviewReasonCodes.length ? (
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-subtle">검토 사유</p>
          <ReasonBadges reasons={policyCase.reviewReasonCodes} />
        </div>
      ) : null}
      <p className="text-[11px] text-subtle">
        초안 생성 {policyCase.draftLatencyMs !== null ? `${policyCase.draftLatencyMs.toLocaleString("ko-KR")}ms` : "시간 미기록"}
        {policyCase.draftProvider ? ` · ${policyCase.draftProvider}${policyCase.draftModel ? ` / ${policyCase.draftModel}` : ""}` : ""}
      </p>
    </section>
  );
}
