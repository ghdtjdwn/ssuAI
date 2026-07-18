import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionBadge } from "@/components/shell/ConnectionsPanel";
import { ToastProvider } from "@/components/ui/toast";
import { useLibraryAuth } from "@/contexts/LibraryAuthContext";
import { useSaintAuth } from "@/hooks/useSaintAuth";

import { useConnections } from "./useConnections";

vi.mock("@/hooks/useSaintAuth", () => ({
  useSaintAuth: vi.fn(),
}));

vi.mock("@/contexts/LibraryAuthContext", () => ({
  useLibraryAuth: vi.fn(),
}));

vi.mock("./useConnections", () => ({
  useConnections: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(useSaintAuth).mockReturnValue({
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    logout: vi.fn(),
    refresh: vi.fn(),
    user: null,
  });
  vi.mocked(useLibraryAuth).mockReturnValue({
    credentialRevision: 0,
    isConnected: false,
    logout: vi.fn(),
    markCredentialsRefreshed: vi.fn(),
    setConnected: vi.fn(),
  });
});

function renderBadge() {
  return render(
    <ToastProvider>
      <ConnectionBadge />
    </ToastProvider>,
  );
}

describe("ConnectionBadge", () => {
  it("shows stale grants as unverified instead of a fresh 3/3", () => {
    vi.mocked(useConnections).mockReturnValue({
      saint: "stale",
      lms: "stale",
      library: "stale",
      count: 0,
      lastKnownCount: 3,
      status: "stale",
    });

    renderBadge();

    const badge = screen.getByRole("button", {
      name: "서비스 연결 상태 확인 불가, 마지막 확인 3/3",
    });
    expect(badge).toHaveTextContent("?/3");
    fireEvent.click(badge);

    expect(
      screen.getByText(/현재 연결 상태를 확인하지 못했습니다. 마지막 확인은 3\/3/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("현재 상태 확인 불가 · 자동 재확인")).toHaveLength(3);
    expect(screen.queryByText("연결됨 · 최대 7일 유지")).not.toBeInTheDocument();
  });

  it("renders a provider ERROR as degraded with a reconnect action", () => {
    vi.mocked(useConnections).mockReturnValue({
      saint: "connected",
      lms: "degraded",
      library: "connected",
      count: 2,
      lastKnownCount: 2,
      status: "verified",
    });

    renderBadge();

    const badge = screen.getByRole("button", {
      name: "서비스 연결 2/3, 일부 상태 확인 필요",
    });
    expect(badge).toHaveTextContent("2/3");
    fireEvent.click(badge);

    expect(screen.getByRole("button", { name: "LMS 다시 연결" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "u-SAINT 연결 해제" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "도서관 연결 해제" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "서비스 연결 3/3" }),
    ).not.toBeInTheDocument();
  });

  it("counts UNKNOWN providers but presents them as informationally unverified", () => {
    vi.mocked(useConnections).mockReturnValue({
      saint: "unverified",
      lms: "unverified",
      library: "unverified",
      count: 3,
      lastKnownCount: 3,
      status: "verified",
    });

    renderBadge();

    const badge = screen.getByRole("button", {
      name: "서비스 연결 3/3, 일부 상태 미확인",
    });
    expect(badge).toHaveTextContent("3/3상태 미확인");
    expect(badge).toHaveClass("text-primary");
    expect(badge).not.toHaveClass("text-warning");
    fireEvent.click(badge);

    const panel = within(screen.getByRole("dialog"));
    expect(panel.getAllByText(/상태 미확인$/)).toHaveLength(3);
    const libraryStatus = panel.getAllByText("연결됨 · 상태 미확인")[1];
    expect(libraryStatus).toHaveClass("text-primary");
    expect(screen.queryByRole("button", { name: /다시 연결/ })).not.toBeInTheDocument();
  });
});
