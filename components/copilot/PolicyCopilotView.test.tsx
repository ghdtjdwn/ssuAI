import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSaintAuth, type SaintAuthState } from "@/hooks/useSaintAuth";
import type { PolicyCase } from "@/lib/api/copilot";

import { CitationList, PolicyCaseDetails } from "./PolicyCaseDetails";
import { PolicyCopilotView } from "./PolicyCopilotView";

vi.mock("@/hooks/useSaintAuth", () => ({ useSaintAuth: vi.fn() }));
vi.mock("@/components/auth/SaintLoginButton", () => ({ SaintLoginButton: ({ label }: { label: string }) => <button>{label}</button> }));

const mockAuth = vi.mocked(useSaintAuth);
const fetchMock = vi.fn<typeof fetch>();

function auth(overrides: Partial<SaintAuthState> = {}): SaintAuthState {
  return { accessToken: "token", isAuthenticated: true, isLoading: false, logout: vi.fn(), refresh: vi.fn(), user: { name: "학생", studentId: "20240001", major: "컴퓨터학부", enrollmentStatus: "재학" }, ...overrides };
}

const policyCase: PolicyCase = {
  id: 1, status: "PENDING_REVIEW" as const, question: "복수전공 신청 요건을 알려주세요.", category: "graduation", aiDraft: "초안 답변", finalAnswer: null, rejectionReason: null,
  citations: [{ sourceId: "rule-1", title: "학사 규정", url: "https://rule.ssu.ac.kr/lmxsrv/law/lawDetail.do?SEQ=99", revision: "2026-1", effectiveDate: "2026-03-01", lastVerifiedDate: "2026-07-20", revisionVerified: true, heading: "제10조" }],
  reviewReasonCodes: ["UNRESOLVED_CONDITION" as const], sourceOrigin: "academic-policy", draftProvider: "test", draftModel: "test-model", draftLatencyMs: 123, createdAt: "2026-07-20T00:00:00Z", reviewStartedAt: null, reviewedAt: null, claimedByCurrentReviewer: false, claimExpiresAt: null, version: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const envelope = (data: unknown, status = 200) =>
  Response.json({ data, error: null, traceId: "trace-policy" }, { status });

function mockRecent(cases: PolicyCase[] = []) {
  fetchMock.mockResolvedValueOnce(envelope(cases));
}

describe("PolicyCopilotView", () => {
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); mockAuth.mockReturnValue(auth()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("does not send a request when signed out", () => {
    mockAuth.mockReturnValue(auth({ accessToken: null, isAuthenticated: false, user: null }));
    render(<PolicyCopilotView />);
    expect(screen.getByText("정책 Copilot은 로그인이 필요해요")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates the question length before submission", async () => {
    mockRecent();
    render(<PolicyCopilotView />);
    expect(await screen.findByText("아직 제출한 정책 요청이 없습니다.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("정책 질문"), { target: { value: "짧음" } });
    fireEvent.click(screen.getByRole("button", { name: "근거 기반 초안 요청" }));
    expect(screen.getByText("질문은 10자 이상 1,000자 이하로 작성해 주세요.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
  });

  it("shows the unposted draft, citations and review reasons after success", async () => {
    mockRecent();
    fetchMock.mockResolvedValueOnce(Response.json({ data: policyCase, error: null, traceId: "trace-1" }));
    render(<PolicyCopilotView />);
    await screen.findByText("아직 제출한 정책 요청이 없습니다.");
    fireEvent.change(screen.getByLabelText("정책 질문"), { target: { value: policyCase.question } });
    fireEvent.click(screen.getByRole("button", { name: "근거 기반 초안 요청" }));
    expect(await screen.findByText("AI 초안 — 지정 검토자 확인 전")).toBeInTheDocument();
    expect(screen.getByText("학사 규정")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "학사 규정 (새 탭에서 열림)" })).toHaveAttribute("href", policyCase.citations[0]?.url);
    expect(screen.getByText("개정 검증")).toBeInTheDocument();
    expect(screen.getByText("추가 확인 조건 있음")).toBeInTheDocument();
    expect(screen.getAllByText("졸업·학점").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/자동으로 게시되지 않습니다/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "최근 정책 요청" })).getByRole("button", {
        name: new RegExp(policyCase.question),
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/copilot/policy-cases", expect.objectContaining({ method: "POST" }));
  });

  it("surfaces an API error and its trace id", async () => {
    mockRecent();
    fetchMock.mockResolvedValueOnce(Response.json({ data: null, error: { code: "COPILOT_UNAVAILABLE", message: "잠시 후 다시 시도" }, traceId: "trace-error" }, { status: 503 }));
    render(<PolicyCopilotView />);
    await screen.findByText("아직 제출한 정책 요청이 없습니다.");
    fireEvent.change(screen.getByLabelText("정책 질문"), { target: { value: policyCase.question } });
    fireEvent.submit(screen.getByRole("button", { name: "근거 기반 초안 요청" }).closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("COPILOT_UNAVAILABLE");
    expect(alert).toHaveTextContent("traceId: trace-error");
  });

  it("refreshes a submitted case and separates the approved final answer", async () => {
    mockRecent();
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: policyCase, error: null, traceId: "trace-create" }))
      .mockResolvedValueOnce(Response.json({
        data: {
          ...policyCase,
          status: "APPROVED",
          finalAnswer: "지정 검토자가 근거를 확인하고 승인한 최종 답변",
          reviewedAt: "2026-07-21T00:00:00Z",
          version: 2,
        },
        error: null,
        traceId: "trace-refresh",
      }));

    render(<PolicyCopilotView />);
    await screen.findByText("아직 제출한 정책 요청이 없습니다.");
    fireEvent.change(screen.getByLabelText("정책 질문"), { target: { value: policyCase.question } });
    fireEvent.click(screen.getByRole("button", { name: "근거 기반 초안 요청" }));
    fireEvent.click(await screen.findByRole("button", { name: "검토 상태 새로고침" }));

    expect(await screen.findByText("지정 검토자 승인 최종본")).toBeInTheDocument();
    expect(screen.getByText("지정 검토자가 근거를 확인하고 승인한 최종 답변")).toBeInTheDocument();
    expect(screen.getByText("초안 답변")).toBeInTheDocument();
    expect(screen.getByText(/승인한 최종 답변과 기존 AI 초안을 구분/)).toBeInTheDocument();
    expect(screen.queryByText("지정 검토자 확인 전 초안입니다. 자동 게시되거나 개인별 행정 판단에 사용되지 않습니다.")).not.toBeInTheDocument();
    const recentButton = within(screen.getByRole("list", { name: "최근 정책 요청" })).getByRole("button", {
      name: new RegExp(policyCase.question),
    });
    expect(within(recentButton).getByText("승인됨")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/copilot/policy-cases/1",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("restores recent requests and lets the user select an earlier result after re-login", async () => {
    const approvedCase: PolicyCase = {
      ...policyCase,
      id: 3,
      status: "APPROVED",
      question: "장학금 신청 기준을 알려주세요.",
      finalAnswer: "승인된 장학금 안내",
      reviewedAt: "2026-07-22T00:00:00Z",
      createdAt: "2026-07-22T00:00:00Z",
      version: 2,
    };
    const earlierCase: PolicyCase = {
      ...policyCase,
      id: 2,
      question: "졸업 학점 기준을 알려주세요.",
      createdAt: "2026-07-21T00:00:00Z",
    };
    mockRecent([approvedCase, earlierCase]);

    render(<PolicyCopilotView />);

    expect(await screen.findByText("승인된 장학금 안내")).toBeInTheDocument();
    const recentList = screen.getByRole("list", { name: "최근 정책 요청" });
    expect(within(recentList).getAllByRole("button")).toHaveLength(2);
    fireEvent.click(
      within(recentList).getByRole("button", { name: new RegExp(earlierCase.question) }),
    );

    expect(screen.getByText(/지정 검토자 확인 전 초안입니다/)).toBeInTheDocument();
    expect(screen.queryByText("승인된 장학금 안내")).not.toBeInTheDocument();
    expect(
      within(recentList).getByRole("button", { name: new RegExp(earlierCase.question) }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps submission available while history loads and preserves a new case when that load finishes", async () => {
    const historyResponse = deferred<Response>();
    fetchMock.mockImplementation((input, init) => {
      if (String(input) === "/api/copilot/policy-cases" && init?.method === "POST") {
        return Promise.resolve(envelope(policyCase));
      }
      if (String(input) === "/api/copilot/policy-cases") return historyResponse.promise;
      return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
    });

    render(<PolicyCopilotView />);

    expect(screen.getByRole("status")).toHaveTextContent("최근 요청을 불러오는 중");
    expect(screen.getByRole("button", { name: "근거 기반 초안 요청" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("정책 질문"), {
      target: { value: policyCase.question },
    });
    fireEvent.click(screen.getByRole("button", { name: "근거 기반 초안 요청" }));
    expect(await screen.findByText("AI 초안 — 지정 검토자 확인 전")).toBeInTheDocument();

    await act(async () => {
      historyResponse.resolve(envelope([]));
      await historyResponse.promise;
    });

    const recentList = screen.getByRole("list", { name: "최근 정책 요청" });
    expect(
      within(recentList).getByRole("button", { name: new RegExp(policyCase.question) }),
    ).toBeInTheDocument();
  });

  it("shows a retryable history error without blocking the submission form", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          data: null,
          error: { code: "COPILOT_UNAVAILABLE", message: "최근 요청을 불러오지 못했습니다." },
          traceId: "trace-history",
        },
        { status: 503 },
      ),
    );

    render(<PolicyCopilotView />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("최근 요청을 불러오지 못했습니다.");
    expect(alert).toHaveTextContent("traceId: trace-history");
    expect(screen.getByRole("button", { name: "최근 요청 다시 불러오기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "근거 기반 초안 요청" })).toBeEnabled();
  });

  it("ignores an old account's delayed history after the principal changes", async () => {
    const oldHistory = deferred<Response>();
    const oldCase: PolicyCase = { ...policyCase, id: 11, question: "이전 계정 정책 요청" };
    const nextCase: PolicyCase = { ...policyCase, id: 12, question: "새 계정 정책 요청" };
    fetchMock.mockImplementation((_input, init) => {
      const authorization = (init?.headers as Headers).get("Authorization");
      return authorization === "Bearer token-b"
        ? Promise.resolve(envelope([nextCase]))
        : oldHistory.promise;
    });
    const { rerender } = render(<PolicyCopilotView />);
    expect(screen.getByRole("status")).toHaveTextContent("최근 요청을 불러오는 중");

    mockAuth.mockReturnValue(auth({
      accessToken: "token-b",
      user: { name: "다른 학생", studentId: "20240002", major: null, enrollmentStatus: "재학" },
    }));
    rerender(<PolicyCopilotView />);

    expect((await screen.findAllByText(nextCase.question)).length).toBeGreaterThan(0);
    await act(async () => {
      oldHistory.resolve(envelope([oldCase]));
      await oldHistory.promise;
    });

    expect(screen.queryAllByText(oldCase.question)).toHaveLength(0);
    expect(screen.getByLabelText("정책 질문")).toHaveValue("");
  });

  it("resets every local field when the authenticated principal changes", async () => {
    mockRecent();
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: policyCase, error: null, traceId: "trace-create" }))
      .mockResolvedValueOnce(envelope([]));
    const { rerender } = render(<PolicyCopilotView />);

    await screen.findByText("아직 제출한 정책 요청이 없습니다.");
    fireEvent.change(screen.getByLabelText("분류"), { target: { value: "scholarship" } });
    fireEvent.change(screen.getByLabelText("정책 질문"), { target: { value: policyCase.question } });
    fireEvent.click(screen.getByRole("button", { name: "근거 기반 초안 요청" }));
    expect(await screen.findByText("초안 답변")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("정책 질문"), { target: { value: "짧음" } });
    fireEvent.click(screen.getByRole("button", { name: "근거 기반 초안 요청" }));
    expect(screen.getByRole("alert")).toHaveTextContent("질문은 10자 이상");

    mockAuth.mockReturnValue(auth({
      accessToken: "token-b",
      user: { name: "다른 학생", studentId: "20240002", major: "경영학부", enrollmentStatus: "재학" },
    }));
    rerender(<PolicyCopilotView />);

    expect(screen.getByLabelText("정책 질문")).toHaveValue("");
    expect(screen.getByLabelText("분류")).toHaveValue("academic");
    expect(screen.queryByText("초안 답변")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "근거 기반 초안 요청" })).toBeEnabled();
    expect(await screen.findByText("아직 제출한 정책 요청이 없습니다.")).toBeInTheDocument();
  });

  it("ignores a stale submit completion after an account switch", async () => {
    const staleResponse = deferred<Response>();
    mockRecent();
    fetchMock
      .mockReturnValueOnce(staleResponse.promise)
      .mockResolvedValueOnce(envelope([]));
    const { rerender } = render(<PolicyCopilotView />);

    await screen.findByText("아직 제출한 정책 요청이 없습니다.");
    fireEvent.change(screen.getByLabelText("정책 질문"), { target: { value: policyCase.question } });
    fireEvent.click(screen.getByRole("button", { name: "근거 기반 초안 요청" }));
    expect(screen.getByRole("button", { name: "초안 생성 요청 중…" })).toBeDisabled();

    mockAuth.mockReturnValue(auth({
      accessToken: "token-b",
      user: { name: "다른 학생", studentId: "20240002", major: null, enrollmentStatus: "재학" },
    }));
    rerender(<PolicyCopilotView />);

    await act(async () => {
      staleResponse.resolve(Response.json({ data: policyCase, error: null, traceId: "stale" }));
      await staleResponse.promise;
    });

    expect(screen.queryByText("초안 답변")).not.toBeInTheDocument();
    expect(screen.getByLabelText("정책 질문")).toHaveValue("");
    expect(screen.getByRole("button", { name: "근거 기반 초안 요청" })).toBeEnabled();
    expect(await screen.findByText("아직 제출한 정책 요청이 없습니다.")).toBeInTheDocument();
  });

  it("mutually disables submit and refresh while either request is active", async () => {
    const submitResponse = deferred<Response>();
    const refreshResponse = deferred<Response>();
    mockRecent();
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: policyCase, error: null, traceId: "initial" }))
      .mockReturnValueOnce(submitResponse.promise)
      .mockReturnValueOnce(refreshResponse.promise);
    render(<PolicyCopilotView />);

    await screen.findByText("아직 제출한 정책 요청이 없습니다.");
    fireEvent.change(screen.getByLabelText("정책 질문"), { target: { value: policyCase.question } });
    fireEvent.click(screen.getByRole("button", { name: "근거 기반 초안 요청" }));
    const refreshButton = await screen.findByRole("button", { name: "검토 상태 새로고침" });

    fireEvent.change(screen.getByLabelText("정책 질문"), { target: { value: "장학 신청 절차와 기준을 알려주세요." } });
    fireEvent.click(screen.getByRole("button", { name: "근거 기반 초안 요청" }));
    expect(refreshButton).toBeDisabled();

    await act(async () => {
      submitResponse.resolve(Response.json({ data: { ...policyCase, id: 2 }, error: null, traceId: "second" }));
      await submitResponse.promise;
    });
    const enabledRefresh = await screen.findByRole("button", { name: "검토 상태 새로고침" });
    fireEvent.click(enabledRefresh);
    expect(screen.getByRole("button", { name: "근거 기반 초안 요청" })).toBeDisabled();

    await act(async () => {
      refreshResponse.resolve(Response.json({ data: { ...policyCase, id: 2 }, error: null, traceId: "refresh" }));
      await refreshResponse.promise;
    });
  });

  it("keeps a rejected AI draft distinct from its rejection reason", () => {
    render(
      <PolicyCaseDetails
        policyCase={{
          ...policyCase,
          status: "REJECTED",
          rejectionReason: "현재 개정본 여부를 확인할 수 없습니다.",
          reviewReasonCodes: ["REVISION_UNVERIFIED"],
        }}
      />,
    );

    expect(screen.getByText("AI 초안")).toBeInTheDocument();
    expect(screen.getByText("초안 답변")).toBeInTheDocument();
    expect(screen.getByText("현재 개정본 여부를 확인할 수 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("개정 검증 필요")).toBeInTheDocument();
    expect(screen.getByText("이 AI 초안은 게시되지 않습니다.")).toBeInTheDocument();
  });

  it("does not activate a non-official citation URL", () => {
    render(
      <CitationList
        citations={[{
          sourceId: "unsafe-source",
          title: "검증되지 않은 링크",
          url: "javascript:alert(1)",
          revision: null,
          effectiveDate: null,
          lastVerifiedDate: null,
          revisionVerified: false,
          heading: null,
        }]}
      />,
    );

    expect(screen.getByText("검증되지 않은 링크")).toBeInTheDocument();
    expect(screen.getByText("공식 링크 확인 필요")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
