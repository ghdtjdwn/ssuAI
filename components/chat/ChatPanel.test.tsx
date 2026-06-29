import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { useSaintAuth, type SaintAuthState } from "@/hooks/useSaintAuth";
import { createMcpWebSession } from "@/lib/api/agent";

vi.mock("@/hooks/useSaintAuth", () => ({
  useSaintAuth: vi.fn(),
}));

vi.mock("@/lib/api/agent", () => ({
  createMcpWebSession: vi.fn(),
  readAgentStream: vi.fn(),
  resumeAgentStream: vi.fn(),
  startAgentStream: vi.fn(),
}));

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
