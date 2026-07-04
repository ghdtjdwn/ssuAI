import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { useSaintAuth, type SaintAuthState } from "@/hooks/useSaintAuth";
import { AgentStreamError, createMcpWebSession, startAgentStream } from "@/lib/api/agent";

vi.mock("@/hooks/useSaintAuth", () => ({
  useSaintAuth: vi.fn(),
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

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  sessionStorage.clear();
  vi.mocked(createMcpWebSession).mockReset();
  vi.mocked(useSaintAuth).mockImplementation(() => authState);
  setAuthState({});
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
    const { readAgentStream } = await import("@/lib/api/agent");
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
});
