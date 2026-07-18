import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { ToastProvider } from "@/components/ui/toast";
import { useLibraryAuth } from "@/contexts/LibraryAuthContext";
import { McpSessionProvider } from "@/contexts/McpSessionContext";
import { useSaintAuth, type SaintAuthState } from "@/hooks/useSaintAuth";
import {
  AgentStreamError,
  createMcpWebSession,
  getMcpWebSessionStatus,
  readAgentStream,
  resumeAgentStream,
  startAgentStream,
  type McpWebSessionResponse,
} from "@/lib/api/agent";
import { ApiError } from "@/lib/api/types";

vi.mock("@/hooks/useSaintAuth", () => ({
  useSaintAuth: vi.fn(),
}));

vi.mock("@/contexts/LibraryAuthContext", () => ({
  useLibraryAuth: vi.fn(),
}));

vi.mock("@/lib/api/agent", () => {
  // Keep a real AgentStreamError so `instanceof` in the 403 self-heal works.
  class AgentStreamError extends Error {
    status: number;
    constructor(endpoint: string, status: number) {
      super(`ssuAgent ${endpoint} returned ${status}`);
      this.name = "AgentStreamError";
      this.status = status;
    }
  }
  return {
    AgentStreamError,
    createMcpWebSession: vi.fn(),
    getMcpWebSessionStatus: vi.fn(),
    readAgentStream: vi.fn(),
    resumeAgentStream: vi.fn(),
    startAgentStream: vi.fn(),
  };
});

const THREAD_ID_KEY = "ssuagent_thread_id";

let authState: SaintAuthState;
let libraryAuthState: ReturnType<typeof useLibraryAuth>;

function setAuthState(overrides: Partial<SaintAuthState>) {
  authState = {
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    logout: vi.fn(),
    refresh: vi.fn(),
    user: null,
    ...overrides,
  };
}

function setLibraryAuthState(overrides: Partial<ReturnType<typeof useLibraryAuth>> = {}) {
  libraryAuthState = {
    credentialRevision: 0,
    isConnected: false,
    logout: vi.fn(),
    markCredentialsRefreshed: vi.fn(),
    setConnected: vi.fn(),
    ...overrides,
  };
}

function ChatTestProviders({ children }: { children: React.ReactNode }) {
  return (
    <McpSessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </McpSessionProvider>
  );
}

function renderChat() {
  return render(<ChatPanel />, { wrapper: ChatTestProviders });
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

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  sessionStorage.clear();
  vi.mocked(createMcpWebSession).mockReset();
  vi.mocked(getMcpWebSessionStatus).mockReset();
  vi.mocked(readAgentStream).mockReset();
  vi.mocked(resumeAgentStream).mockReset();
  vi.mocked(startAgentStream).mockReset();
  vi.mocked(useSaintAuth).mockImplementation(() => authState);
  vi.mocked(useLibraryAuth).mockImplementation(() => libraryAuthState);
  setAuthState({});
  setLibraryAuthState();
});

describe("ChatPanel", () => {
  it("resets the agent thread and clears MCP session state after logout", async () => {
    sessionStorage.setItem(THREAD_ID_KEY, "thread-before-logout");
    setAuthState({
      accessToken: "access-token",
      isAuthenticated: true,
      user: {
        enrollmentStatus: "재학",
        major: "컴퓨터학부",
        name: "홍길동",
        studentId: "20231234",
      },
    });
    vi.mocked(createMcpWebSession).mockResolvedValue({
      expiresAt: "2099-06-30T01:00:00Z",
      linkedProviders: ["SAINT", "LMS"],
      mcpSessionId: "mcp-session-before-logout",
    });

    const { rerender } = renderChat();

    expect(sessionStorage.getItem(THREAD_ID_KEY)).toBe("thread-before-logout");
    expect(await screen.findByText("개인 서비스 2/3 연결")).toBeInTheDocument();

    setAuthState({
      accessToken: null,
      isAuthenticated: false,
      user: null,
    });
    rerender(<ChatPanel />);

    await waitFor(() => {
      expect(sessionStorage.getItem(THREAD_ID_KEY)).not.toBe("thread-before-logout");
    });
    expect(sessionStorage.getItem(THREAD_ID_KEY)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("공개 도구 모드")).toBeInTheDocument();
    });
  });

  it("self-heals a 403 by abandoning the orphaned thread and retrying once", async () => {
    // A stale thread from a prior mcp_session is now owned by someone else.
    sessionStorage.setItem(THREAD_ID_KEY, "stale-thread");
    setLibraryAuthState({ isConnected: true });
    setAuthState({
      accessToken: "access-token",
      isAuthenticated: true,
      user: {
        enrollmentStatus: "재학",
        major: "컴퓨터학부",
        name: "홍길동",
        studentId: "20231234",
      },
    });
    vi.mocked(createMcpWebSession).mockResolvedValue({
      expiresAt: "2099-06-30T01:00:00Z",
      linkedProviders: ["SAINT", "LMS", "LIBRARY"],
      mcpSessionId: "mcp-session-new",
    });
    vi.mocked(readAgentStream).mockImplementation(async function* () {
      yield { type: "done" } as never;
    });
    // First call 403s (owner mismatch); the retry with a fresh thread succeeds.
    vi.mocked(startAgentStream)
      .mockRejectedValueOnce(new AgentStreamError("/agent/stream", 403))
      .mockResolvedValueOnce({} as Response);

    renderChat();
    await screen.findByText("개인 서비스 3/3 연결");

    fireEvent.change(screen.getByPlaceholderText("메시지를 입력하세요"), {
      target: { value: "졸업까지 어떤 조건들이 남았어?" },
    });
    fireEvent.submit(screen.getByPlaceholderText("메시지를 입력하세요").closest("form")!);

    await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(2));

    const firstThread = vi.mocked(startAgentStream).mock.calls[0][1];
    const retryThread = vi.mocked(startAgentStream).mock.calls[1][1];
    expect(firstThread).toBe("stale-thread");
    expect(retryThread).not.toBe("stale-thread");
    expect(vi.mocked(startAgentStream).mock.calls[0][3]).toBe(true);
    expect(vi.mocked(startAgentStream).mock.calls[1][3]).toBe(true);
    expect(sessionStorage.getItem(THREAD_ID_KEY)).toBe(retryThread);
    // The 403 was healed, so no error surfaces to the user.
    expect(
      screen.queryByText(/returned 403/),
    ).not.toBeInTheDocument();
  });

  it("keeps an existing anonymous thread on first mount", () => {
    sessionStorage.setItem(THREAD_ID_KEY, "anonymous-thread");
    setAuthState({
      accessToken: null,
      isAuthenticated: false,
      user: null,
    });

    renderChat();

    expect(sessionStorage.getItem(THREAD_ID_KEY)).toBe("anonymous-thread");
    expect(createMcpWebSession).not.toHaveBeenCalled();
  });

  describe("MCP session acquisition", () => {
    function mockDoneStream() {
      vi.mocked(startAgentStream).mockResolvedValue({} as Response);
      vi.mocked(readAgentStream).mockImplementation(async function* () {
        yield { type: "done" } as never;
      });
    }

    function submit(text: string) {
      const input = screen.getByPlaceholderText("메시지를 입력하세요");
      fireEvent.change(input, { target: { value: text } });
      fireEvent.submit(input.closest("form")!);
    }

    it("mints a library-only MCP session and sends it to the agent stream", async () => {
      setLibraryAuthState({ isConnected: true });
      vi.mocked(createMcpWebSession).mockResolvedValue({
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["LIBRARY"],
        mcpSessionId: "library-mcp-session",
      });
      mockDoneStream();

      renderChat();

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledWith(null));
      await screen.findByText("개인 서비스 1/3 연결");
      submit("도서관 자리 있어?");

      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(startAgentStream).toHaveBeenCalledWith(
        "도서관 자리 있어?",
        expect.any(String),
        "library-mcp-session",
        true,
        null,
      );
    });

    it("mints a SAINT-backed MCP session when only SAINT is authenticated", async () => {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      vi.mocked(createMcpWebSession).mockResolvedValue({
        availableProviders: ["SAINT", "LMS"],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS"],
        mcpSessionId: "saint-mcp-session",
      });
      mockDoneStream();

      renderChat();

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledWith("access-token"));
      await screen.findByText("개인 서비스 2/3 연결");
      submit("졸업까지 어떤 조건들이 남았어?");

      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(startAgentStream).toHaveBeenCalledWith(
        "졸업까지 어떤 조건들이 남았어?",
        expect.any(String),
        "saint-mcp-session",
        false,
        "access-token",
      );
    });

    it("shows a degraded provider as partial instead of connected", async () => {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      setLibraryAuthState({ isConnected: true });
      vi.mocked(createMcpWebSession).mockResolvedValue({
        availableProviders: ["SAINT", "LMS"],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS", "LIBRARY"],
        mcpSessionId: "degraded-library-session",
        providerHealth: {
          SAINT: "VALID",
          LMS: "UNKNOWN",
          LIBRARY: "ERROR",
        },
      });
      mockDoneStream();

      renderChat();

      expect(
        await screen.findByText("개인 서비스 2/3 · 일부 확인 필요"),
      ).toBeInTheDocument();
      submit("도서관 자리 있어?");
      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(vi.mocked(startAgentStream).mock.calls[0][3]).toBe(false);
    });

    it("re-mints when the library identity becomes available after a SAINT session", async () => {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      vi.mocked(createMcpWebSession)
        .mockResolvedValueOnce({
          expiresAt: "2099-06-30T01:00:00Z",
          linkedProviders: ["SAINT", "LMS"],
          mcpSessionId: "saint-mcp-session",
        })
        .mockResolvedValueOnce({
          expiresAt: "2099-06-30T01:00:00Z",
          linkedProviders: ["SAINT", "LMS", "LIBRARY"],
          mcpSessionId: "saint-library-mcp-session",
        });

      const { rerender } = renderChat();

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledTimes(1));
      expect(createMcpWebSession).toHaveBeenLastCalledWith("access-token");

      setLibraryAuthState({ isConnected: true });
      rerender(<ChatPanel />);

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledTimes(2));
      expect(createMcpWebSession).toHaveBeenLastCalledWith("access-token");
    });

    it("keeps the MCP session when the access JWT rotates for the same student", async () => {
      const user = {
        enrollmentStatus: "재학",
        major: "컴퓨터학부",
        name: "홍길동",
        studentId: "20231234",
      };
      setAuthState({
        accessToken: "access-token-before-refresh",
        isAuthenticated: true,
        user,
      });
      vi.mocked(createMcpWebSession).mockResolvedValue({
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS"],
        mcpSessionId: "stable-mcp-session",
      });
      mockDoneStream();

      const { rerender } = renderChat();
      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledTimes(1));

      setAuthState({
        accessToken: "access-token-after-refresh",
        isAuthenticated: true,
        user,
      });
      rerender(<ChatPanel />);
      submit("졸업요건 알려줘");

      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(createMcpWebSession).toHaveBeenCalledTimes(1);
      expect(startAgentStream).toHaveBeenCalledWith(
        "졸업요건 알려줘",
        expect.any(String),
        "stable-mcp-session",
        false,
        "access-token-after-refresh",
      );
    });

    it("refreshes live provider grants when the chat window regains focus", async () => {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      vi.mocked(createMcpWebSession).mockResolvedValue({
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: [],
        mcpSessionId: "provider-session",
      });
      vi.mocked(getMcpWebSessionStatus).mockResolvedValue({
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS"],
        mcpSessionId: "provider-session",
      });

      renderChat();
      expect(await screen.findByText("개인 서비스 0/3 · 연결 필요")).toBeInTheDocument();

      fireEvent.focus(window);

      await waitFor(() => {
        expect(getMcpWebSessionStatus).toHaveBeenCalledWith(
          "provider-session",
          "access-token",
        );
      });
      expect(await screen.findByText("개인 서비스 2/3 연결")).toBeInTheDocument();
      expect(createMcpWebSession).toHaveBeenCalledTimes(1);
    });

    it("keeps the valid MCP session when a live status refresh fails transiently", async () => {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      vi.mocked(createMcpWebSession).mockResolvedValue({
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS"],
        mcpSessionId: "stable-session",
      });
      vi.mocked(getMcpWebSessionStatus).mockRejectedValue(
        new ApiError("UPSTREAM_UNAVAILABLE", "temporary", "trace-1", 503),
      );
      mockDoneStream();

      renderChat();
      expect(await screen.findByText("개인 서비스 2/3 연결")).toBeInTheDocument();

      fireEvent.focus(window);
      await waitFor(() => expect(getMcpWebSessionStatus).toHaveBeenCalledTimes(1));
      expect(await screen.findByText("연결 상태 확인 불가")).toBeInTheDocument();
      expect(screen.queryByText("개인 서비스 2/3 연결")).not.toBeInTheDocument();
      submit("졸업요건 알려줘");

      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(createMcpWebSession).toHaveBeenCalledTimes(1);
      expect(startAgentStream).toHaveBeenCalledWith(
        "졸업요건 알려줘",
        expect.any(String),
        "stable-session",
        false,
        "access-token",
      );
    });

    it("recovers from a stale status check without rotating the session", async () => {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      const healthySession: McpWebSessionResponse = {
        availableProviders: ["SAINT", "LMS"],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS"],
        mcpSessionId: "recoverable-session",
        providerHealth: {
          SAINT: "VALID",
          LMS: "VALID",
        },
      };
      vi.mocked(createMcpWebSession).mockResolvedValue(healthySession);
      vi.mocked(getMcpWebSessionStatus)
        .mockRejectedValueOnce(
          new ApiError("UPSTREAM_UNAVAILABLE", "temporary", "trace-stale", 503),
        )
        .mockResolvedValueOnce(healthySession);

      renderChat();
      expect(await screen.findByText("개인 서비스 2/3 연결")).toBeInTheDocument();

      fireEvent.focus(window);
      expect(await screen.findByText("연결 상태 확인 불가")).toBeInTheDocument();

      fireEvent.focus(window);
      expect(await screen.findByText("개인 서비스 2/3 연결")).toBeInTheDocument();
      expect(getMcpWebSessionStatus).toHaveBeenCalledTimes(2);
      expect(createMcpWebSession).toHaveBeenCalledTimes(1);
    });

    it("queues one forced refresh behind an in-flight check and coalesces duplicates", async () => {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      setLibraryAuthState({ isConnected: true });
      const initialSession: McpWebSessionResponse = {
        availableProviders: ["SAINT", "LMS", "LIBRARY"],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS", "LIBRARY"],
        mcpSessionId: "queued-refresh-session",
        providerHealth: {
          SAINT: "VALID",
          LMS: "VALID",
          LIBRARY: "VALID",
        },
      };
      const firstStatus = deferred<Awaited<ReturnType<typeof getMcpWebSessionStatus>>>();
      const streamSettlement = deferred<void>();
      vi.mocked(createMcpWebSession).mockResolvedValue(initialSession);
      vi.mocked(getMcpWebSessionStatus)
        .mockReturnValueOnce(firstStatus.promise)
        .mockResolvedValueOnce({
          ...initialSession,
          availableProviders: ["SAINT", "LIBRARY"],
          providerHealth: {
            SAINT: "VALID",
            LMS: "ERROR",
            LIBRARY: "VALID",
          },
        });
      vi.mocked(startAgentStream).mockResolvedValue({} as Response);
      vi.mocked(readAgentStream).mockImplementation(async function* () {
        await streamSettlement.promise;
        yield { type: "done" } as never;
      });

      renderChat();
      expect(await screen.findByText("개인 서비스 3/3 연결")).toBeInTheDocument();
      submit("이번 주 과제를 확인해줘");
      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));

      fireEvent.focus(window);
      await waitFor(() => expect(getMcpWebSessionStatus).toHaveBeenCalledTimes(1));

      streamSettlement.resolve();
      await waitFor(() =>
        expect(screen.getByPlaceholderText("메시지를 입력하세요")).not.toBeDisabled(),
      );
      fireEvent.focus(window);
      fireEvent.focus(window);
      expect(getMcpWebSessionStatus).toHaveBeenCalledTimes(1);

      firstStatus.resolve(initialSession);
      await waitFor(() => expect(getMcpWebSessionStatus).toHaveBeenCalledTimes(2));
      expect(
        await screen.findByText("개인 서비스 2/3 · 일부 확인 필요"),
      ).toBeInTheDocument();
      expect(getMcpWebSessionStatus).toHaveBeenCalledTimes(2);
    });

    it("drops a queued forced refresh when the web identity changes", async () => {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      const initialSession: McpWebSessionResponse = {
        availableProviders: ["SAINT", "LMS"],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS"],
        mcpSessionId: "old-identity-session",
      };
      const firstStatus = deferred<Awaited<ReturnType<typeof getMcpWebSessionStatus>>>();
      vi.mocked(createMcpWebSession).mockResolvedValue(initialSession);
      vi.mocked(getMcpWebSessionStatus).mockReturnValue(firstStatus.promise);

      const { rerender } = renderChat();
      expect(await screen.findByText("개인 서비스 2/3 연결")).toBeInTheDocument();

      fireEvent.focus(window);
      await waitFor(() => expect(getMcpWebSessionStatus).toHaveBeenCalledTimes(1));
      fireEvent.focus(window);

      setAuthState({ accessToken: null, isAuthenticated: false, user: null });
      rerender(<ChatPanel />);
      expect(await screen.findByText("공개 도구 모드")).toBeInTheDocument();

      firstStatus.resolve(initialSession);
      await firstStatus.promise;
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(createMcpWebSession).toHaveBeenCalledTimes(1);
      expect(getMcpWebSessionStatus).toHaveBeenCalledTimes(1);
    });

    it("refreshes provider health immediately after an agent stream settles", async () => {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      setLibraryAuthState({ isConnected: true });
      vi.mocked(createMcpWebSession).mockResolvedValue({
        availableProviders: ["SAINT", "LMS", "LIBRARY"],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS", "LIBRARY"],
        mcpSessionId: "health-refresh-session",
        providerHealth: {
          SAINT: "VALID",
          LMS: "UNKNOWN",
          LIBRARY: "UNKNOWN",
        },
      });
      vi.mocked(getMcpWebSessionStatus).mockResolvedValue({
        availableProviders: ["SAINT", "LIBRARY"],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS", "LIBRARY"],
        mcpSessionId: "health-refresh-session",
        providerHealth: {
          SAINT: "VALID",
          LMS: "ERROR",
          LIBRARY: "UNKNOWN",
        },
      });
      mockDoneStream();

      renderChat();
      expect(
        await screen.findByText("개인 서비스 3/3 연결 · 상태 미확인"),
      ).toBeInTheDocument();
      submit("이번 주 마감인 과제 있어?");

      await waitFor(() => {
        expect(getMcpWebSessionStatus).toHaveBeenCalledWith(
          "health-refresh-session",
          "access-token",
        );
      });
      expect(
        await screen.findByText("개인 서비스 2/3 · 일부 확인 필요"),
      ).toBeInTheDocument();
    });

    it("reissues the MCP session when library credentials are refreshed in place", async () => {
      setLibraryAuthState({ credentialRevision: 1, isConnected: true });
      vi.mocked(createMcpWebSession)
        .mockResolvedValueOnce({
          expiresAt: "2099-06-30T01:00:00Z",
          linkedProviders: ["LIBRARY"],
          mcpSessionId: "library-session-before-refresh",
        })
        .mockResolvedValueOnce({
          expiresAt: "2099-06-30T01:00:00Z",
          linkedProviders: ["LIBRARY"],
          mcpSessionId: "library-session-after-refresh",
        });
      mockDoneStream();

      const { rerender } = renderChat();
      expect(await screen.findByText("개인 서비스 1/3 연결")).toBeInTheDocument();

      setLibraryAuthState({ credentialRevision: 2, isConnected: true });
      rerender(<ChatPanel />);
      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledTimes(2));
      submit("도서관 대출 알려줘");

      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(startAgentStream).toHaveBeenCalledWith(
        "도서관 대출 알려줘",
        expect.any(String),
        "library-session-after-refresh",
        true,
        null,
      );
    });

    it("does not mint an MCP session without SAINT or library identity", () => {
      renderChat();

      expect(screen.getByText("공개 도구 모드")).toBeInTheDocument();
      expect(createMcpWebSession).not.toHaveBeenCalled();
    });

    it("waits for the in-flight MCP session before sending an authenticated message", async () => {
      setAuthState({ accessToken: "access-token", isAuthenticated: true });
      const pending = deferred<Awaited<ReturnType<typeof createMcpWebSession>>>();
      vi.mocked(createMcpWebSession).mockReturnValue(pending.promise);
      mockDoneStream();

      renderChat();
      submit("졸업요건 알려줘");

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledTimes(1));
      expect(startAgentStream).not.toHaveBeenCalled();

      pending.resolve({
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS"],
        mcpSessionId: "waited-session",
      });

      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(vi.mocked(startAgentStream).mock.calls[0][2]).toBe("waited-session");
    });

    it("surfaces acquisition failure and retries on the next send", async () => {
      setAuthState({ accessToken: "access-token", isAuthenticated: true });
      vi.mocked(createMcpWebSession)
        .mockRejectedValueOnce(new Error("backend 500"))
        .mockResolvedValueOnce({
          expiresAt: "2099-06-30T01:00:00Z",
          linkedProviders: ["SAINT", "LMS"],
          mcpSessionId: "retry-session",
        });
      mockDoneStream();

      renderChat();
      expect(await screen.findByText("연결 세션 오류")).toBeInTheDocument();
      submit("졸업요건 알려줘");

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(vi.mocked(startAgentStream).mock.calls[0][2]).toBe("retry-session");
    });

    it("treats an older backend response without grants as disconnected", async () => {
      setAuthState({ accessToken: "access-token", isAuthenticated: true });
      vi.mocked(createMcpWebSession).mockResolvedValue({
        expiresAt: "2099-06-30T01:00:00Z",
        mcpSessionId: "providerless-session",
      });
      mockDoneStream();

      renderChat();

      expect(await screen.findByText("개인 서비스 0/3 · 연결 필요")).toBeInTheDocument();
      submit("도서관 자리 있어?");
      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(vi.mocked(startAgentStream).mock.calls[0][2]).toBe("providerless-session");
      expect(vi.mocked(startAgentStream).mock.calls[0][3]).toBe(false);
    });
  });

  describe("streaming render", () => {
    function setAuthedUser() {
      setAuthState({
        accessToken: "access-token",
        isAuthenticated: true,
        user: {
          enrollmentStatus: "재학",
          major: "컴퓨터학부",
          name: "홍길동",
          studentId: "20231234",
        },
      });
      vi.mocked(createMcpWebSession).mockResolvedValue({
        availableProviders: ["SAINT", "LMS", "LIBRARY"],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS", "LIBRARY"],
        mcpSessionId: "mcp-session",
        providerHealth: {
          SAINT: "UNKNOWN",
          LMS: "UNKNOWN",
          LIBRARY: "UNKNOWN",
        },
      });
      vi.mocked(startAgentStream).mockResolvedValue({} as Response);
    }

    async function mockStream(
      events: Array<Record<string, unknown>>,
    ) {
      vi.mocked(readAgentStream).mockImplementation(async function* () {
        for (const event of events) {
          yield event as never;
        }
      });
    }

    function submit(text: string) {
      const input = screen.getByPlaceholderText("메시지를 입력하세요");
      fireEvent.change(input, { target: { value: text } });
      fireEvent.submit(input.closest("form")!);
    }

    it("passes the current library connection flag to startAgentStream", async () => {
      setAuthedUser();
      setLibraryAuthState({ isConnected: true });
      await mockStream([{ type: "done" }]);

      renderChat();
      const connectionStatus = await screen.findByRole("status");
      expect(connectionStatus).toHaveTextContent(
        "개인 서비스 3/3 연결 · 상태 미확인",
      );
      expect(connectionStatus).toHaveAttribute("aria-live", "polite");
      expect(connectionStatus).toHaveAttribute("aria-atomic", "true");
      submit("도서관 자리 있어?");

      await waitFor(() => expect(startAgentStream).toHaveBeenCalledTimes(1));
      expect(startAgentStream).toHaveBeenCalledWith(
        "도서관 자리 있어?",
        expect.any(String),
        "mcp-session",
        true,
        "access-token",
      );
    });

    it("pins an interrupted action to its MCP session and refreshes only after resume settles", async () => {
      setAuthedUser();
      setLibraryAuthState({ isConnected: true });
      vi.mocked(createMcpWebSession)
        .mockReset()
        .mockResolvedValueOnce({
          availableProviders: ["SAINT", "LMS", "LIBRARY"],
          expiresAt: "2099-06-30T01:00:00Z",
          linkedProviders: ["SAINT", "LMS", "LIBRARY"],
          mcpSessionId: "interrupt-owner-session",
          providerHealth: {
            SAINT: "VALID",
            LMS: "UNKNOWN",
            LIBRARY: "UNKNOWN",
          },
        })
        .mockResolvedValueOnce({
          availableProviders: ["SAINT", "LMS", "LIBRARY"],
          expiresAt: "2099-06-30T01:00:00Z",
          linkedProviders: ["SAINT", "LMS", "LIBRARY"],
          mcpSessionId: "rotated-after-resume-session",
          providerHealth: {
            SAINT: "VALID",
            LMS: "VALID",
            LIBRARY: "VALID",
          },
        });
      vi.mocked(getMcpWebSessionStatus).mockRejectedValue(
        new ApiError("SESSION_NOT_FOUND", "expired", "trace-hitl", 401),
      );
      vi.mocked(resumeAgentStream).mockResolvedValue({} as Response);
      vi.mocked(readAgentStream)
        .mockImplementationOnce(async function* () {
          yield {
            type: "interrupt",
            data: {
              type: "approval",
              action_id: 7,
              details: { message: "도서관 3층 12번 좌석 예약" },
            },
          } as never;
        })
        .mockImplementationOnce(async function* () {
          yield { type: "done" } as never;
        });

      renderChat();
      await screen.findByText("개인 서비스 3/3 연결 · 상태 미확인");
      submit("자리 예약해줘");
      const approveButton = await screen.findByRole("button", { name: "승인" });

      expect(getMcpWebSessionStatus).not.toHaveBeenCalled();
      expect(createMcpWebSession).toHaveBeenCalledTimes(1);
      fireEvent.click(approveButton);

      await waitFor(() => expect(resumeAgentStream).toHaveBeenCalledTimes(1));
      expect(resumeAgentStream).toHaveBeenCalledWith(
        expect.any(String),
        true,
        7,
        "interrupt-owner-session",
        true,
        "access-token",
      );
      await waitFor(() => expect(getMcpWebSessionStatus).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledTimes(2));
    });

    it("streams assistant text and settles the bubble when the stream is done", async () => {
      setAuthedUser();
      await mockStream([
        { type: "text", content: "졸업까지 " },
        { type: "text", content: "3학점 남았어요." },
        { type: "done" },
      ]);

      renderChat();
      await screen.findByText("개인 서비스 3/3 연결 · 상태 미확인");
      submit("내 졸업 요건 알려줘");

      // Chunks concatenate into a single settled assistant bubble.
      expect(await screen.findByText("졸업까지 3학점 남았어요.")).toBeInTheDocument();
      // Composer re-enables once the stream reports done.
      await waitFor(() =>
        expect(screen.getByPlaceholderText("메시지를 입력하세요")).not.toBeDisabled(),
      );
    });

    it("settles an LMS export link as a clickable download action", async () => {
      setAuthedUser();
      const downloadUrl =
        "https://ssumcp.duckdns.org/api/lms/exports/job-1/download?token=test-token";
      await mockStream([
        {
          type: "text",
          content: `[LMS 에이전트] 준비됐어요.\n\n[강의 파일 다운로드](${downloadUrl})`,
        },
        { type: "done" },
      ]);

      renderChat();
      await screen.findByText("개인 서비스 3/3 연결 · 상태 미확인");
      submit("수강 중인 모든 강의 파일을 받아줘");

      const link = await screen.findByRole("link", {
        name: "강의 파일 다운로드 (새 탭에서 열림)",
      });
      expect(link).toHaveAttribute("href", downloadUrl);
      expect(link).toHaveAttribute("data-download-action", "lms-export");
    });

    it("renders handoff and tool steps as status lines while streaming", async () => {
      setAuthedUser();
      await mockStream([
        { type: "handoff", agent: "library_agent", message: "좌석을 찾고 있어요" },
        { type: "tool", name: "get_seats", label: "좌석 조회" },
        { type: "text", content: "빈 자리를 찾았어요." },
        { type: "done" },
      ]);

      renderChat();
      await screen.findByText("개인 서비스 3/3 연결 · 상태 미확인");
      submit("도서관 자리 있어?");

      expect(
        await screen.findByText("[library_agent] 좌석을 찾고 있어요"),
      ).toBeInTheDocument();
      expect(screen.getByText("좌석 조회")).toBeInTheDocument();
      expect(await screen.findByText("빈 자리를 찾았어요.")).toBeInTheDocument();
    });

    it("shows a HITL approval card when the stream interrupts", async () => {
      setAuthedUser();
      await mockStream([
        {
          type: "interrupt",
          data: {
            type: "approval",
            action_id: 7,
            details: { message: "도서관 3층 12번 좌석 예약" },
          },
        },
      ]);

      renderChat();
      await screen.findByText("개인 서비스 3/3 연결 · 상태 미확인");
      submit("자리 예약해줘");

      expect(await screen.findByText("승인이 필요한 작업이에요")).toBeInTheDocument();
      expect(screen.getByText("도서관 3층 12번 좌석 예약")).toBeInTheDocument();
      // Composer switches to the approval-pending placeholder.
      expect(
        screen.getByPlaceholderText("위 요청을 승인하거나 취소해주세요"),
      ).toBeInTheDocument();
    });

    it("surfaces a stream error event as an alert", async () => {
      setAuthedUser();
      await mockStream([
        { type: "text", content: "부분 응답" },
        { type: "error", message: "에이전트 내부 오류가 발생했어요." },
      ]);

      renderChat();
      await screen.findByText("개인 서비스 3/3 연결 · 상태 미확인");
      submit("뭔가 물어봄");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("에이전트 내부 오류가 발생했어요.");
      // Text streamed before the error is preserved as a settled bubble.
      expect(screen.getByText("부분 응답")).toBeInTheDocument();
    });
  });
});
