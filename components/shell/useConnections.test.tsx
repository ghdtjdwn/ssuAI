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
  it("falls back to legacy linked provider grants", () => {
    vi.mocked(useMcpSession).mockReturnValue({
      session: {
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LIBRARY"],
        mcpSessionId: "session-id",
      },
      status: "connected",
      error: null,
      ensureSession: vi.fn(),
      refreshSession: vi.fn(),
    });

    const { result } = renderHook(() => useConnections());

    expect(result.current).toEqual({
      saint: "connected",
      lms: "disconnected",
      library: "connected",
      count: 2,
      lastKnownCount: 2,
      status: "verified",
    });
  });

  it("prefers availableProviders over legacy linked grants", () => {
    vi.mocked(useMcpSession).mockReturnValue({
      session: {
        availableProviders: ["LIBRARY"],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS", "LIBRARY"],
        mcpSessionId: "availability-session",
      },
      status: "connected",
      error: null,
      ensureSession: vi.fn(),
      refreshSession: vi.fn(),
    });

    const { result } = renderHook(() => useConnections());

    expect(result.current).toEqual({
      saint: "disconnected",
      lms: "disconnected",
      library: "connected",
      count: 1,
      lastKnownCount: 1,
      status: "verified",
    });
  });

  it("treats an explicit empty availableProviders list as authoritative", () => {
    vi.mocked(useMcpSession).mockReturnValue({
      session: {
        availableProviders: [],
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS", "LIBRARY"],
        mcpSessionId: "no-available-providers",
      },
      status: "connected",
      error: null,
      ensureSession: vi.fn(),
      refreshSession: vi.fn(),
    });

    const { result } = renderHook(() => useConnections());

    expect(result.current.count).toBe(0);
    expect(result.current.saint).toBe("disconnected");
    expect(result.current.lms).toBe("disconnected");
    expect(result.current.library).toBe("disconnected");
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
      refreshSession: vi.fn(),
    });

    const { result } = renderHook(() => useConnections());

    expect(result.current.count).toBe(0);
    expect(result.current.lastKnownCount).toBe(0);
    expect(result.current.saint).toBe("disconnected");
    expect(result.current.lms).toBe("disconnected");
    expect(result.current.library).toBe("disconnected");
    expect(result.current.status).toBe("verified");
  });

  it("supports health-only rollout and distinguishes usable UNKNOWN", () => {
    vi.mocked(useMcpSession).mockReturnValue({
      session: {
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS", "LIBRARY"],
        mcpSessionId: "health-session",
        providerHealth: {
          SAINT: "UNKNOWN",
          LMS: "ERROR",
          LIBRARY: "EXPIRED",
        },
      },
      status: "connected",
      error: null,
      ensureSession: vi.fn(),
      refreshSession: vi.fn(),
    });

    const { result } = renderHook(() => useConnections());

    expect(result.current).toEqual({
      saint: "unverified",
      lms: "degraded",
      library: "expired",
      count: 1,
      lastKnownCount: 1,
      status: "verified",
    });
  });

  it("marks cached grants stale when live status verification is unavailable", () => {
    vi.mocked(useMcpSession).mockReturnValue({
      session: {
        expiresAt: "2099-06-30T01:00:00Z",
        linkedProviders: ["SAINT", "LMS", "LIBRARY"],
        mcpSessionId: "stale-session",
        providerHealth: {
          SAINT: "VALID",
          LMS: "ERROR",
          LIBRARY: "EXPIRED",
        },
      },
      status: "stale",
      error: "개인 서비스 연결 상태를 확인하지 못했습니다.",
      ensureSession: vi.fn(),
      refreshSession: vi.fn(),
    });

    const { result } = renderHook(() => useConnections());

    expect(result.current).toEqual({
      saint: "stale",
      lms: "stale",
      library: "stale",
      count: 0,
      lastKnownCount: 1,
      status: "stale",
    });
  });
});
