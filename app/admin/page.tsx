"use client";

import { useEffect, useRef, useState } from "react";

import { getSsoInitUrl } from "@/lib/api/auth";
import { useSaintAuth } from "@/hooks/useSaintAuth";

interface CircuitBreakerInfo {
  name: string;
  state: string;
  failureRate: number;
  slowCallRate: number;
}

interface ResilienceResponse {
  circuitBreakers: CircuitBreakerInfo[];
}

class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = "AdminApiError";
    this.status = status;
  }
}

function isAuthorizationError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError && (error.status === 401 || error.status === 403);
}

function StateBadge({ state }: { state: string }) {
  const colorMap: Record<string, string> = {
    CLOSED: "bg-emerald-500/10 text-emerald-400",
    OPEN: "bg-red-500/10 text-red-400",
    HALF_OPEN: "bg-amber-500/10 text-amber-400",
    FORCED_OPEN: "bg-red-500/20 text-red-300",
    DISABLED: "bg-slate-500/10 text-slate-400",
    METRICS_ONLY: "bg-slate-500/10 text-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${colorMap[state] ?? "bg-slate-500/10 text-slate-400"}`}
    >
      {state}
    </span>
  );
}

function formatRate(rate: number): string {
  if (rate < 0) return "—";
  return `${rate.toFixed(1)}%`;
}

async function fetchResilienceApi(accessToken: string): Promise<ResilienceResponse> {
  const res = await fetch("/api/admin/resilience", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new AdminApiError(res.status);
  return res.json() as Promise<ResilienceResponse>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<ResilienceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const requestGenerationRef = useRef(0);
  // Admin is owner-only on the backend (ssuai.admin.student-ids → 403). The page
  // requires a login before it even calls the API; a logged-in non-owner still
  // gets a 403 from the backend, surfaced as an access-denied message below.
  const { accessToken, isAuthenticated, isLoading: authLoading } = useSaintAuth();

  useEffect(() => {
    // Not logged in: skip the API call entirely (the component early-returns the
    // login prompt below, so the dashboard's loading state is never shown).
    if (!isAuthenticated || !accessToken) {
      return;
    }
    let cancelled = false;
    const initialGeneration = ++requestGenerationRef.current;

    fetchResilienceApi(accessToken)
      .then((json) => {
        if (!cancelled && initialGeneration === requestGenerationRef.current) {
          setData(json);
          setError(null);
          setLastRefreshed(new Date());
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled && initialGeneration === requestGenerationRef.current) {
          if (isAuthorizationError(e)) {
            setData(null);
            setLastRefreshed(null);
          }
          setError(e instanceof Error ? e.message : "알 수 없는 오류");
          setLoading(false);
        }
      });

    const interval = setInterval(() => {
      const pollingGeneration = ++requestGenerationRef.current;
      fetchResilienceApi(accessToken)
        .then((json) => {
          if (!cancelled && pollingGeneration === requestGenerationRef.current) {
            setData(json);
            setError(null);
            setLastRefreshed(new Date());
          }
        })
        .catch((e: unknown) => {
          if (
            !cancelled &&
            pollingGeneration === requestGenerationRef.current &&
            isAuthorizationError(e)
          ) {
            setData(null);
            setLastRefreshed(null);
            setError(e.message);
          }
          // Transient polling failures keep the last known data without noise.
          // Authentication/authorization failures are surfaced above because
          // continuing to show a stale owner-only dashboard would be misleading.
        })
        .finally(() => {
          if (!cancelled && pollingGeneration === requestGenerationRef.current) {
            setLoading(false);
          }
        });
    }, 30_000);

    return () => {
      cancelled = true;
      requestGenerationRef.current += 1;
      clearInterval(interval);
    };
  }, [accessToken, isAuthenticated]);

  function handleRefresh() {
    if (!isAuthenticated || !accessToken) return;
    const refreshGeneration = ++requestGenerationRef.current;
    setLoading(true);
    setError(null);
    fetchResilienceApi(accessToken)
      .then((json) => {
        if (refreshGeneration !== requestGenerationRef.current) return;
        setData(json);
        setError(null);
        setLastRefreshed(new Date());
      })
      .catch((e: unknown) => {
        if (refreshGeneration !== requestGenerationRef.current) return;
        if (isAuthorizationError(e)) {
          setData(null);
          setLastRefreshed(null);
        }
        setError(e instanceof Error ? e.message : "알 수 없는 오류");
      })
      .finally(() => {
        if (refreshGeneration === requestGenerationRef.current) {
          setLoading(false);
        }
      });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-400 text-sm">인증 확인 중…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-100">관리자 대시보드</h1>
          <p className="text-slate-400 text-sm">이 페이지는 로그인이 필요합니다.</p>
          <a
            href={getSsoInitUrl()}
            className="inline-block px-4 py-2 text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition"
          >
            u-SAINT 로그인
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        <header className="flex justify-between items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-indigo-500 bg-clip-text text-transparent">
              ssuAI 어드민 대시보드
            </h1>
            <p className="text-slate-400 mt-1">시스템 런타임 상태 모니터링</p>
          </div>
          <div className="flex items-center space-x-4">
            {lastRefreshed && (
              <span className="text-xs text-slate-500">
                {lastRefreshed.toLocaleTimeString("ko-KR")} 갱신
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition disabled:opacity-50"
            >
              {loading ? "로딩 중..." : "새로고침"}
            </button>
          </div>
        </header>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-slate-100 mb-4">
            Resilience4j Circuit Breaker 상태
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            외부 시스템(Pyxis 도서관, LLM 프로바이더)의 서킷 브레이커 실시간 상태입니다.
            에러율이 임계값(50%, 슬라이딩 윈도우 10회 이상)을 초과하면 자동으로 OPEN됩니다.
          </p>

          {error && (
            <div className="mb-4 p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-sm">
              {error.includes("403")
                ? "이 대시보드는 관리자 전용입니다. 접근 권한이 없습니다."
                : `API 호출 실패: ${error}`}
            </div>
          )}

          {loading && !data && (
            <div className="text-slate-400 text-sm py-8 text-center">로딩 중...</div>
          )}

          {data && (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      서킷 브레이커
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      실패율
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      슬로콜율
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-900 divide-y divide-slate-800">
                  {data.circuitBreakers.map((cb) => (
                    <tr key={cb.name} className="hover:bg-slate-800/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-slate-200">
                        {cb.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <StateBadge state={cb.state} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {formatRate(cb.failureRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {formatRate(cb.slowCallRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
