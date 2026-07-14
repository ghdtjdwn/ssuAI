import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { ToastProvider } from "@/components/ui/toast";
import { useLibraryAuth } from "@/contexts/LibraryAuthContext";
import { useSaintAuth, type SaintAuthState } from "@/hooks/useSaintAuth";
import {
  AgentStreamError,
  createMcpWebSession,
  readAgentStream,
  resumeAgentStream,
  startAgentStream,
} from "@/lib/api/agent";

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
    isConnected: false,
    logout: vi.fn(),
    setConnected: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  sessionStorage.clear();
  vi.mocked(createMcpWebSession).mockReset();
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
      expiresAt: "2026-06-30T01:00:00Z",
      mcpSessionId: "mcp-session-before-logout",
    });

    const { rerender } = render(<ChatPanel />);

    expect(sessionStorage.getItem(THREAD_ID_KEY)).toBe("thread-before-logout");
    expect(await screen.findByText("MCP 연결됨")).toBeInTheDocument();

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
      expiresAt: "2026-06-30T01:00:00Z",
      mcpSessionId: "mcp-session-new",
    });
    vi.mocked(readAgentStream).mockImplementation(async function* () {
      yield { type: "done" } as never;
    });
    // First call 403s (owner mismatch); the retry with a fresh thread succeeds.
    vi.mocked(startAgentStream)
      .mockRejectedValueOnce(new AgentStreamError("/agent/stream", 403))
      .mockResolvedValueOnce({} as Response);

    render(<ChatPanel />);
    await screen.findByText("MCP 연결됨");

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

    render(<ChatPanel />);

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
        expiresAt: "2026-06-30T01:00:00Z",
        mcpSessionId: "library-mcp-session",
      });
      mockDoneStream();

      render(<ChatPanel />);

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledWith(null));
      await screen.findByText("MCP 연결됨");
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
        expiresAt: "2026-06-30T01:00:00Z",
        mcpSessionId: "saint-mcp-session",
      });
      mockDoneStream();

      render(<ChatPanel />);

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledWith("access-token"));
      await screen.findByText("MCP 연결됨");
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
          expiresAt: "2026-06-30T01:00:00Z",
          mcpSessionId: "saint-mcp-session",
        })
        .mockResolvedValueOnce({
          expiresAt: "2026-06-30T01:00:00Z",
          mcpSessionId: "saint-library-mcp-session",
        });

      const { rerender } = render(<ChatPanel />);

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledTimes(1));
      expect(createMcpWebSession).toHaveBeenLastCalledWith("access-token");

      setLibraryAuthState({ isConnected: true });
      rerender(<ChatPanel />);

      await waitFor(() => expect(createMcpWebSession).toHaveBeenCalledTimes(2));
      expect(createMcpWebSession).toHaveBeenLastCalledWith("access-token");
    });

    it("does not mint an MCP session without SAINT or library identity", () => {
      render(<ChatPanel />);

      expect(screen.getByText("공개 도구 모드")).toBeInTheDocument();
      expect(createMcpWebSession).not.toHaveBeenCalled();
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
        expiresAt: "2026-06-30T01:00:00Z",
        mcpSessionId: "mcp-session",
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

      render(<ChatPanel />);
      await screen.findByText("MCP 연결됨");
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

    it("passes the current library connection flag to resumeAgentStream", async () => {
      setAuthedUser();
      setLibraryAuthState({ isConnected: true });
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

      render(<ChatPanel />, { wrapper: ToastProvider });
      await screen.findByText("MCP 연결됨");
      submit("자리 예약해줘");
      fireEvent.click(await screen.findByRole("button", { name: "승인" }));

      await waitFor(() => expect(resumeAgentStream).toHaveBeenCalledTimes(1));
      expect(resumeAgentStream).toHaveBeenCalledWith(
        expect.any(String),
        true,
        7,
        "mcp-session",
        true,
        "access-token",
      );
    });

    it("streams assistant text and settles the bubble when the stream is done", async () => {
      setAuthedUser();
      await mockStream([
        { type: "text", content: "졸업까지 " },
        { type: "text", content: "3학점 남았어요." },
        { type: "done" },
      ]);

      render(<ChatPanel />);
      await screen.findByText("MCP 연결됨");
      submit("내 졸업 요건 알려줘");

      // Chunks concatenate into a single settled assistant bubble.
      expect(await screen.findByText("졸업까지 3학점 남았어요.")).toBeInTheDocument();
      // Composer re-enables once the stream reports done.
      await waitFor(() =>
        expect(screen.getByPlaceholderText("메시지를 입력하세요")).not.toBeDisabled(),
      );
    });

    it("renders handoff and tool steps as status lines while streaming", async () => {
      setAuthedUser();
      await mockStream([
        { type: "handoff", agent: "library_agent", message: "좌석을 찾고 있어요" },
        { type: "tool", name: "get_seats", label: "좌석 조회" },
        { type: "text", content: "빈 자리를 찾았어요." },
        { type: "done" },
      ]);

      render(<ChatPanel />);
      await screen.findByText("MCP 연결됨");
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

      render(<ChatPanel />, { wrapper: ToastProvider });
      await screen.findByText("MCP 연결됨");
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

      render(<ChatPanel />);
      await screen.findByText("MCP 연결됨");
      submit("뭔가 물어봄");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("에이전트 내부 오류가 발생했어요.");
      // Text streamed before the error is preserved as a settled bubble.
      expect(screen.getByText("부분 응답")).toBeInTheDocument();
    });
  });
});
