import { fetchJson } from "./client";

export type PolicyCaseStatus = "PENDING_REVIEW" | "IN_REVIEW" | "APPROVED" | "REJECTED";
export type PolicyDecision = "APPROVE" | "REJECT";
export type PolicyCategory = "academic" | "graduation" | "scholarship";
export type PolicyReviewReasonCode =
  | "NO_EVIDENCE"
  | "FALLBACK_SOURCE"
  | "REVISION_UNVERIFIED"
  | "UNRESOLVED_CONDITION"
  | "DRAFT_GENERATION_FAILED";

export interface PolicyCitation {
  sourceId: string;
  title: string;
  url: string;
  revision: string | null;
  effectiveDate: string | null;
  lastVerifiedDate: string | null;
  revisionVerified: boolean;
  heading: string | null;
}

export interface PolicyCase {
  id: number;
  status: PolicyCaseStatus;
  question: string;
  category: PolicyCategory | null;
  aiDraft: string | null;
  finalAnswer: string | null;
  rejectionReason: string | null;
  citations: PolicyCitation[];
  reviewReasonCodes: PolicyReviewReasonCode[];
  sourceOrigin: string | null;
  draftProvider: string | null;
  draftModel: string | null;
  draftLatencyMs: number | null;
  createdAt: string;
  reviewStartedAt: string | null;
  reviewedAt: string | null;
  claimedByCurrentReviewer: boolean;
  claimExpiresAt: string | null;
  version: number;
}

export interface PolicyCaseMetrics {
  totalCases: number;
  pendingCases: number;
  inReviewCases: number;
  approvedCases: number;
  rejectedCases: number;
  averageDraftLatencyMs: number | null;
  averageReviewDurationMs: number | null;
  approvalRate: number | null;
  unchangedApprovalRate: number | null;
  correctionRate: number | null;
  citationCoverageRate: number | null;
  safeHoldRate: number | null;
}

function authHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export function createPolicyCase(
  accessToken: string,
  input: { question: string; category?: PolicyCategory },
  signal?: AbortSignal,
) {
  return fetchJson<PolicyCase>("/api/copilot/policy-cases", {
    method: "POST",
    headers: authHeader(accessToken),
    body: JSON.stringify(input),
    signal,
  });
}

export function listPolicyCases(accessToken: string, signal?: AbortSignal) {
  return fetchJson<PolicyCase[]>("/api/copilot/policy-cases", {
    headers: authHeader(accessToken),
    signal,
  });
}

export function getPolicyCase(accessToken: string, id: number, signal?: AbortSignal) {
  return fetchJson<PolicyCase>(`/api/copilot/policy-cases/${encodeURIComponent(id)}`, {
    headers: authHeader(accessToken),
    signal,
  });
}

export function listReviewerPolicyCases(
  accessToken: string,
  status?: PolicyCaseStatus,
  signal?: AbortSignal,
) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchJson<PolicyCase[]>(`/api/reviewer/policy-cases${query}`, {
    headers: authHeader(accessToken),
    signal,
  });
}

export function claimReviewerPolicyCase(accessToken: string, id: number, signal?: AbortSignal) {
  return fetchJson<PolicyCase>(`/api/reviewer/policy-cases/${encodeURIComponent(id)}/claim`, {
    method: "POST",
    headers: authHeader(accessToken),
    signal,
  });
}

export function decideReviewerPolicyCase(
  accessToken: string,
  id: number,
  input: {
    expectedVersion: number;
    decision: PolicyDecision;
    finalAnswer?: string;
    rejectionReason?: string;
  },
  signal?: AbortSignal,
) {
  return fetchJson<PolicyCase>(`/api/reviewer/policy-cases/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    headers: authHeader(accessToken),
    body: JSON.stringify(input),
    signal,
  });
}

export function getReviewerPolicyCaseMetrics(accessToken: string, signal?: AbortSignal) {
  return fetchJson<PolicyCaseMetrics>("/api/reviewer/policy-cases/metrics", {
    headers: authHeader(accessToken),
    signal,
  });
}
