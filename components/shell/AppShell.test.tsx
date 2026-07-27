import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSaintAuth } from "@/hooks/useSaintAuth";

import { AppShell } from "./AppShell";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));
vi.mock("@/hooks/useSaintAuth", () => ({ useSaintAuth: vi.fn() }));
vi.mock("./AppLaunchSplash", () => ({ AppLaunchSplash: () => null }));
vi.mock("./ConnectionsPanel", () => ({ ConnectionBadge: () => <span>연결</span> }));
vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => <button>테마</button> }));

const mockAuth = vi.mocked(useSaintAuth);

describe("AppShell policy copilot navigation", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/copilot");
    mockAuth.mockReturnValue({
      accessToken: "token",
      isAuthenticated: true,
      isLoading: false,
      logout: vi.fn(),
      refresh: vi.fn(),
      user: {
        name: "학생",
        studentId: "20240001",
        major: "컴퓨터학부",
        enrollmentStatus: "재학",
      },
    });
  });

  it("keeps five mobile tabs and exposes copilot through the desktop sidebar and mobile top bar", () => {
    render(<AppShell><p>내용</p></AppShell>);

    const bottomNavigation = screen.getByRole("navigation", { name: "하단 탭" });
    expect(within(bottomNavigation).getAllByRole("link")).toHaveLength(5);
    expect(within(bottomNavigation).queryByRole("link", { name: "정책 Copilot" })).not.toBeInTheDocument();
    expect(bottomNavigation.firstElementChild).toHaveClass("grid-cols-5");

    expect(screen.getAllByRole("link", { name: "정책 Copilot" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "정책 답변 검토" })).not.toBeInTheDocument();
  });
});
