import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSaintAuth, type SaintAuthState } from "@/hooks/useSaintAuth";

import AdminDashboardPage from "./page";

vi.mock("@/hooks/useSaintAuth", () => ({
  useSaintAuth: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  getSsoInitUrl: () => "/api/auth/sso/init",
}));

const mockUseSaintAuth = vi.mocked(useSaintAuth);
const fetchMock = vi.fn<typeof fetch>();

function authState(overrides: Partial<SaintAuthState> = {}): SaintAuthState {
  return {
    accessToken: "admin-access-token",
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
    refresh: vi.fn(),
    user: {
      enrollmentStatus: "재학",
      major: "컴퓨터학부",
      name: "관리자",
      studentId: "20240001",
    },
    ...overrides,
  };
}

function resilienceResponse(name = "pyxis-read") {
  return new Response(
    JSON.stringify({
      circuitBreakers: [
        { name, state: "CLOSED", failureRate: 0, slowCallRate: 0 },
      ],
    }),
    { headers: { "Content-Type": "application/json" }, status: 200 },
  );
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(resilienceResponse());
    vi.stubGlobal("fetch", fetchMock);
    mockUseSaintAuth.mockReturnValue(authState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends the current access token on the initial admin API request", async () => {
    render(<AdminDashboardPage />);

    expect(await screen.findByText("pyxis-read")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/resilience", {
      cache: "no-store",
      headers: { Authorization: "Bearer admin-access-token" },
    });
  });

  it("sends the access token again on manual refresh", async () => {
    render(<AdminDashboardPage />);
    await screen.findByText("pyxis-read");

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(resilienceResponse());
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/resilience", {
      cache: "no-store",
      headers: { Authorization: "Bearer admin-access-token" },
    });
  });

  it("uses a refreshed access token for later requests", async () => {
    const { rerender } = render(<AdminDashboardPage />);
    await screen.findByText("pyxis-read");

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(resilienceResponse());
    mockUseSaintAuth.mockReturnValue(authState({ accessToken: "refreshed-access-token" }));
    rerender(<AdminDashboardPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/resilience", {
      cache: "no-store",
      headers: { Authorization: "Bearer refreshed-access-token" },
    });
  });

  it("clears a previous 401 after a refreshed token succeeds", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const { rerender } = render(<AdminDashboardPage />);

    expect(await screen.findByText("API 호출 실패: HTTP 401")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(resilienceResponse());
    mockUseSaintAuth.mockReturnValue(authState({ accessToken: "refreshed-access-token" }));
    rerender(<AdminDashboardPage />);

    expect(await screen.findByText("pyxis-read")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("API 호출 실패: HTTP 401")).not.toBeInTheDocument();
    });
  });

  it("surfaces an authorization failure from background polling", async () => {
    let poll: (() => void) | undefined;
    vi.spyOn(globalThis, "setInterval").mockImplementation((handler, timeout) => {
      if (timeout === 30_000) {
        poll = handler as () => void;
      }
      return 1 as unknown as ReturnType<typeof setInterval>;
    });

    const { unmount } = render(<AdminDashboardPage />);
    await screen.findByText("pyxis-read");

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await act(async () => {
      poll?.();
    });

    expect(
      await screen.findByText("이 대시보드는 관리자 전용입니다. 접근 권한이 없습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("pyxis-read")).not.toBeInTheDocument();
    unmount();
  });

  it("ignores a stale manual response after the access token changes", async () => {
    const { rerender } = render(<AdminDashboardPage />);
    await screen.findByText("pyxis-read");

    let resolveOldRequest: ((response: Response) => void) | undefined;
    const oldRequest = new Promise<Response>((resolve) => {
      resolveOldRequest = resolve;
    });
    fetchMock.mockReset();
    fetchMock
      .mockReturnValueOnce(oldRequest)
      .mockResolvedValueOnce(resilienceResponse("new-token-data"));

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    mockUseSaintAuth.mockReturnValue(authState({ accessToken: "refreshed-access-token" }));
    rerender(<AdminDashboardPage />);

    expect(await screen.findByText("new-token-data")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로고침" })).toBeEnabled();

    await act(async () => {
      resolveOldRequest?.(new Response(null, { status: 401 }));
      await oldRequest;
    });

    expect(screen.queryByText("API 호출 실패: HTTP 401")).not.toBeInTheDocument();
    expect(screen.getByText("new-token-data")).toBeInTheDocument();
  });

  it("does not call the admin API while signed out", () => {
    mockUseSaintAuth.mockReturnValue(
      authState({ accessToken: null, isAuthenticated: false, user: null }),
    );

    render(<AdminDashboardPage />);

    expect(screen.getByText("이 페이지는 로그인이 필요합니다.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
