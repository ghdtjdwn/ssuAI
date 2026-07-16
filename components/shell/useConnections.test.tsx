import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMcpSession } from "@/contexts/McpSessionContext";

import { useConnections } from "./useConnections";

vi.mock("@/contexts/McpSessionContext", () => ({
  useMcpSession: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(useMcpSession).mockReset();
});

describe("useConnections", () => {
  it("uses only server-confirmed provider grants", () => {
    vi.mocked(useMcpSession).mockReturnValue({
      session: {
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LIBRARY"],
        mcpSessionId: "session-id",
      },
      status: "connected",
      error: null,
      ensureSession: vi.fn(),
    });

    const { result } = renderHook(() => useConnections());

    expect(result.current).toEqual({
      saint: true,
      lms: false,
      library: true,
      count: 2,
    });
  });

  it("reports zero connections for a providerless session", () => {
    vi.mocked(useMcpSession).mockReturnValue({
      session: {
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: [],
        mcpSessionId: "providerless-session",
      },
      status: "connected",
      error: null,
      ensureSession: vi.fn(),
    });

    const { result } = renderHook(() => useConnections());

    expect(result.current.count).toBe(0);
    expect(result.current.saint).toBe(false);
    expect(result.current.lms).toBe(false);
    expect(result.current.library).toBe(false);
  });
});
