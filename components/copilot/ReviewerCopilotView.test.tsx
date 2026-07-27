import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSaintAuth, type SaintAuthState } from "@/hooks/useSaintAuth";
import type { PolicyCase, PolicyCaseMetrics } from "@/lib/api/copilot";

import { MetricsCards, ReviewerCopilotView } from "./ReviewerCopilotView";

vi.mock("@/hooks/useSaintAuth", () => ({ useSaintAuth: vi.fn() }));
vi.mock("@/components/auth/SaintLoginButton", () => ({
  SaintLoginButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

const mockAuth = vi.mocked(useSaintAuth);
const fetchMock = vi.fn<typeof fetch>();

function auth(overrides: Partial<SaintAuthState> = {}): SaintAuthState {
  return {
    accessToken: "reviewer-token",
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
    refresh: vi.fn(),
    user: {
      name: "검토자",
      studentId: "20240001",
      major: "학사팀",
      enrollmentStatus: "재직",
    },
    ...overrides,
  };
}

const item: PolicyCase = {
  id: 1,
  status: "PENDING_REVIEW",
  question: "졸업 요건을 알려주세요.",
  category: "graduation",
  aiDraft: "초안",
  finalAnswer: null,
  rejectionReason: null,
  citations: [],
  reviewReasonCodes: ["NO_EVIDENCE"],
  sourceOrigin: "official",
  draftProvider: null,
  draftModel: null,
  draftLatencyMs: 100,
  createdAt: "2026-07-20T00:00:00Z",
  reviewStartedAt: null,
  reviewedAt: null,
  claimedByCurrentReviewer: false,
  claimExpiresAt: null,
  version: 1,
};
const claimed: PolicyCase = {
  ...item,
  status: "IN_REVIEW",
  claimedByCurrentReviewer: true,
  claimExpiresAt: "2099-07-20T00:15:00Z",
  reviewStartedAt: "2026-07-20T00:00:00Z",
  version: 2,
};
const metrics: PolicyCaseMetrics = {
  totalCases: 1,
  pendingCases: 1,
  inReviewCases: 0,
  approvedCases: 0,
  rejectedCases: 0,
  averageDraftLatencyMs: 100,
  averageReviewDurationMs: null,
  approvalRate: 0,
  unchangedApprovalRate: 0,
  correctionRate: 0,
  citationCoverageRate: 0,
  safeHoldRate: 0,
};

const envelope = (data: unknown, status = 200) =>
  Response.json({ data, error: null, traceId: "trace-review" }, { status });

const errorEnvelope = (status: number, code: string, traceId = `trace-${status}`) =>
  Response.json(
    { data: null, error: { code, message: code.toLowerCase() }, traceId },
    { status },
  );

function createTestClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

function renderReviewer(client = createTestClient()) {
  const result = render(
    <QueryClientProvider client={client}>
      <ReviewerCopilotView />
    </QueryClientProvider>,
  );
  return { ...result, client };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("ReviewerCopilotView", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAuth.mockReturnValue(auth());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockLoad(cases = [item], loadedMetrics = metrics) {
    fetchMock
      .mockResolvedValueOnce(envelope(cases))
      .mockResolvedValueOnce(envelope(loadedMetrics));
  }

  it("claims a queued case and reloads the complete scoped queue even when a fresh cache exists", async () => {
    const staleCachedCase: PolicyCase = {
      ...claimed,
      id: 98,
      question: "남아 있으면 안 되는 캐시 사례",
    };
    const serverCase: PolicyCase = {
      ...claimed,
      id: 2,
      question: "서버에서 함께 받은 검토 사례",
      claimedByCurrentReviewer: false,
    };
    const inReviewMetrics = { ...metrics, pendingCases: 0, inReviewCases: 2, totalCases: 2 };
    const client = createTestClient();
    client.setQueryData(
      ["policy-review", "20240001", "cases", "IN_REVIEW"],
      [staleCachedCase],
    );
    mockLoad();
    fetchMock
      .mockResolvedValueOnce(envelope(claimed))
      .mockResolvedValueOnce(envelope([claimed, serverCase]))
      .mockResolvedValueOnce(envelope(inReviewMetrics));

    renderReviewer(client);
    fireEvent.click(await screen.findByRole("button", { name: "이 사례 검토 시작" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reviewer/policy-cases/1/claim",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByLabelText("최종 답변")).toHaveValue("초안");
    expect(screen.getByText("서버에서 함께 받은 검토 사례")).toBeInTheDocument();
    expect(screen.queryByText("남아 있으면 안 되는 캐시 사례")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reviewer/policy-cases?status=IN_REVIEW",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByText("졸업·학점")).toBeInTheDocument();
    expect(screen.getAllByText("공식 근거 없음").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps queue and claim available when the independent metrics query fails", async () => {
    const metricsRefreshResponse = deferred<Response>();
    fetchMock
      .mockResolvedValueOnce(envelope([item]))
      .mockResolvedValueOnce(envelope(metrics))
      .mockResolvedValueOnce(envelope(claimed))
      .mockResolvedValueOnce(envelope([claimed]))
      .mockReturnValueOnce(metricsRefreshResponse.promise);

    renderReviewer();

    fireEvent.click(await screen.findByRole("button", { name: "이 사례 검토 시작" }));

    // The required IN_REVIEW case fetch completes before the independent metrics request.
    expect(await screen.findByLabelText("최종 답변")).toHaveValue("초안");
    await act(async () => {
      metricsRefreshResponse.resolve(errorEnvelope(503, "METRICS_UNAVAILABLE"));
      await metricsRefreshResponse.promise;
    });
    expect(screen.getByText(/운영 측정값을 불러오지 못했습니다/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reviewer/policy-cases?status=IN_REVIEW",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("approves an edited draft only when the current reviewer owns the claim", async () => {
    mockLoad([claimed]);
    fetchMock
      .mockResolvedValueOnce(envelope({ ...claimed, finalAnswer: "편집 답변", status: "APPROVED" }))
      .mockResolvedValueOnce(envelope([]))
      .mockResolvedValueOnce(envelope(metrics));

    renderReviewer();
    const answer = await screen.findByLabelText("최종 답변");
    fireEvent.change(answer, { target: { value: "편집 답변" } });
    fireEvent.click(screen.getByRole("button", { name: "편집 내용 승인" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reviewer/policy-cases/1/decision",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            expectedVersion: 2,
            decision: "APPROVE",
            finalAnswer: "편집 답변",
          }),
        }),
      ),
    );
  });

  it("keeps another reviewer's claim anonymous and hides the decision editor", async () => {
    const otherOwner = {
      ...claimed,
      claimedByCurrentReviewer: false,
      claimExpiresAt: "2099-07-20T00:15:00Z",
    };
    mockLoad([otherOwner]);

    renderReviewer();

    expect(await screen.findByText(/현재 서버 응답 기준으로 이 사례의 결정 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByLabelText("최종 답변")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "편집 내용 승인" })).not.toBeInTheDocument();
    expect(screen.getByText(/검토자 신원은 표시하지 않으며/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이 사례 다시 선점" })).toBeInTheDocument();
  });

  it("uses the server claim flag instead of the browser clock for edit authority", async () => {
    mockLoad([{ ...claimed, claimExpiresAt: "2000-01-01T00:00:00Z" }]);

    renderReviewer();

    expect(await screen.findByLabelText("최종 답변")).toHaveValue("초안");
    expect(screen.queryByRole("button", { name: "이 사례 다시 선점" })).not.toBeInTheDocument();
    expect(screen.getByText(/서버 응답의 선점 만료 시각\(정보용\):/)).toBeInTheDocument();
  });

  it("lets the server decide whether an unowned in-review case can be reclaimed", async () => {
    const expiredClaim = {
      ...claimed,
      claimedByCurrentReviewer: false,
      claimExpiresAt: "2000-01-01T00:00:00Z",
    };
    const reclaimed = {
      ...claimed,
      version: 3,
      claimExpiresAt: "2099-07-20T00:30:00Z",
    };
    mockLoad([expiredClaim]);
    fetchMock
      .mockResolvedValueOnce(envelope(reclaimed))
      .mockResolvedValueOnce(envelope([reclaimed]))
      .mockResolvedValueOnce(envelope({ ...metrics, pendingCases: 0, inReviewCases: 1 }));

    renderReviewer();

    expect(await screen.findByRole("status")).toHaveTextContent("다시 선점할 수 있는지는 서버가 판단합니다");
    expect(screen.queryByLabelText("최종 답변")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이 사례 다시 선점" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reviewer/policy-cases/1/claim",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByLabelText("최종 답변")).toHaveValue("초안");
  });

  it("requires and sends a rejection reason", async () => {
    mockLoad([claimed]);
    renderReviewer();

    await screen.findByLabelText("반려 사유");
    fireEvent.click(screen.getByRole("button", { name: "반려" }));
    expect(screen.getByRole("alert")).toHaveTextContent("반려 사유를 입력해 주세요.");

    fetchMock
      .mockResolvedValueOnce(envelope({ ...claimed, status: "REJECTED" }))
      .mockResolvedValueOnce(envelope([]))
      .mockResolvedValueOnce(envelope(metrics));
    fireEvent.change(screen.getByLabelText("반려 사유"), {
      target: { value: "공식 근거가 없습니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "반려" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (call) =>
            String(call[0]).endsWith("/decision") && String(call[1]?.body).includes("REJECT"),
        ),
      ).toBe(true),
    );
  });

  it("latches a queue 403, purges every principal-scoped cache, and locks controls", async () => {
    const client = createTestClient();
    client.setQueryData(
      ["policy-review", "20240001", "cases", "ALL"],
      [{ ...item, id: 99, question: "필터 변경으로 다시 보이면 안 되는 사례" }],
    );
    mockLoad();
    renderReviewer(client);
    expect((await screen.findAllByText(item.question)).length).toBeGreaterThan(0);

    fetchMock.mockResolvedValueOnce(errorEnvelope(403, "FORBIDDEN"));
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/백엔드에서 권한을 받은 검토자/);
    expect(alert).toHaveTextContent("traceId: trace-403");
    expect(screen.queryAllByText(item.question)).toHaveLength(0);
    expect(screen.getByText("표시할 사례가 없습니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("상태 필터")).toBeDisabled();
    expect(screen.getByRole("button", { name: "새로고침" })).toBeDisabled();
    await waitFor(() =>
      expect(
        client.getQueriesData({ queryKey: ["policy-review", "20240001"] })
          .every(([, data]) => data === undefined),
      ).toBe(true),
    );
  });

  it("latches a 403 returned by a reviewer action", async () => {
    mockLoad();
    fetchMock.mockResolvedValueOnce(errorEnvelope(403, "FORBIDDEN", "trace-action-403"));
    const { client } = renderReviewer();

    fireEvent.click(await screen.findByRole("button", { name: "이 사례 검토 시작" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/백엔드에서 권한을 받은 검토자/);
    expect(alert).toHaveTextContent("traceId: trace-action-403");
    expect(screen.queryAllByText(item.question)).toHaveLength(0);
    expect(screen.getByLabelText("상태 필터")).toBeDisabled();
    await waitFor(() =>
      expect(
        client.getQueriesData({ queryKey: ["policy-review", "20240001"] })
          .every(([, data]) => data === undefined),
      ).toBe(true),
    );
  });

  it("treats a metrics 403 as reviewer access denial, not an isolated metrics outage", async () => {
    fetchMock
      .mockResolvedValueOnce(envelope([item]))
      .mockResolvedValueOnce(errorEnvelope(403, "FORBIDDEN", "trace-metrics-403"));
    const { client } = renderReviewer();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/백엔드에서 권한을 받은 검토자/);
    expect(alert).toHaveTextContent("traceId: trace-metrics-403");
    expect(screen.queryAllByText(item.question)).toHaveLength(0);
    expect(screen.getByLabelText("상태 필터")).toBeDisabled();
    await waitFor(() =>
      expect(
        client.getQueriesData({ queryKey: ["policy-review", "20240001"] })
          .every(([, data]) => data === undefined),
      ).toBe(true),
    );
  });

  it("shows server-authorized reclaim only after a 409 decision is refetched", async () => {
    const releasedByServer = {
      ...claimed,
      claimedByCurrentReviewer: false,
      claimExpiresAt: "2000-01-01T00:00:00Z",
      version: 3,
    };
    mockLoad([claimed]);
    fetchMock
      .mockResolvedValueOnce(errorEnvelope(409, "STALE_VERSION"))
      .mockResolvedValueOnce(envelope([releasedByServer]));
    renderReviewer();

    await waitFor(() => expect(screen.getByLabelText("최종 답변")).toHaveValue("초안"));
    fireEvent.click(screen.getByRole("button", { name: "편집 내용 승인" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/선점 기한이 만료되었거나 다른 검토자가 먼저 변경했습니다/);
    fireEvent.click(screen.getByRole("button", { name: "최신 사례 불러오기" }));

    expect(await screen.findByRole("button", { name: "이 사례 다시 선점" })).toBeInTheDocument();
    expect(screen.queryByLabelText("최종 답변")).not.toBeInTheDocument();
  });

  it("marks the selected queue item and connects it to the detail region", async () => {
    const second = { ...item, id: 2, question: "장학 기준을 알려주세요." };
    mockLoad([item, second]);
    renderReviewer();

    const firstButton = await screen.findByRole("button", { name: /졸업 요건을 알려주세요/ });
    const secondButton = screen.getByRole("button", { name: /장학 기준을 알려주세요/ });
    expect(firstButton).toHaveAttribute("aria-pressed", "true");
    expect(firstButton).toHaveAttribute("aria-controls", "reviewer-policy-case-detail");
    expect(document.getElementById("reviewer-policy-case-detail")).toBeInTheDocument();

    fireEvent.click(secondButton);
    expect(secondButton).toHaveAttribute("aria-pressed", "true");
    expect(firstButton).toHaveAttribute("aria-pressed", "false");
  });

  it("isolates queues by principal and removes cached reviewer data on account switch and logout", async () => {
    const otherCase = {
      ...item,
      id: 2,
      question: "다른 계정의 장학 검토 사례",
      category: "scholarship" as const,
    };
    const nextCasesResponse = deferred<Response>();
    const nextMetricsResponse = deferred<Response>();
    mockLoad();
    fetchMock
      .mockReturnValueOnce(nextCasesResponse.promise)
      .mockReturnValueOnce(nextMetricsResponse.promise);
    const { client, rerender } = renderReviewer();
    expect((await screen.findAllByText(item.question)).length).toBeGreaterThan(0);

    mockAuth.mockReturnValue(
      auth({
        accessToken: "reviewer-token-b",
        user: {
          name: "다른 검토자",
          studentId: "20240002",
          major: "장학팀",
          enrollmentStatus: "재직",
        },
      }),
    );
    rerender(
      <QueryClientProvider client={client}>
        <ReviewerCopilotView />
      </QueryClientProvider>,
    );

    expect(screen.queryAllByText(item.question)).toHaveLength(0);
    expect(screen.getByText("검토 사례를 불러오는 중…")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        client.getQueryData(["policy-review", "20240001", "cases", "PENDING_REVIEW"]),
      ).toBeUndefined(),
    );

    await act(async () => {
      nextCasesResponse.resolve(envelope([otherCase]));
      nextMetricsResponse.resolve(envelope(metrics));
      await Promise.all([nextCasesResponse.promise, nextMetricsResponse.promise]);
    });
    expect((await screen.findAllByText(otherCase.question)).length).toBeGreaterThan(0);

    mockAuth.mockReturnValue(
      auth({ accessToken: null, isAuthenticated: false, user: null }),
    );
    rerender(
      <QueryClientProvider client={client}>
        <ReviewerCopilotView />
      </QueryClientProvider>,
    );

    expect(screen.getByText("검토자 로그인이 필요합니다")).toBeInTheDocument();
    await waitFor(() =>
      expect(client.getQueriesData({ queryKey: ["policy-review"] })).toEqual([]),
    );
  });
});

describe("MetricsCards", () => {
  it("does not present zero cases as a performance result", () => {
    render(<MetricsCards metrics={{ ...metrics, totalCases: 0, approvalRate: 0 }} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
    expect(screen.getByText(/아직 집계할 사례가 없다는 뜻/)).toBeInTheDocument();
  });
});
