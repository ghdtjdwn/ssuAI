import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSaintAuth } from "@/hooks/useSaintAuth";
import { useSaintChapel } from "@/hooks/useSaintChapel";
import type { ChapelInfo } from "@/lib/api/types";

import { ChapelCard } from "./ChapelCard";

vi.mock("@/hooks/useSaintAuth", () => ({
  useSaintAuth: vi.fn(),
}));

vi.mock("@/hooks/useSaintChapel", () => ({
  useSaintChapel: vi.fn(),
}));

const chapel: ChapelInfo = {
  year: 2026,
  semester: "1학기",
  chapelTime: "목 10:30-11:20",
  chapelRoom: "한경직기념관 대예배실",
  seatNumber: "J-5-5",
  absenceAllowedMinutes: null,
  absenceUsedMinutes: 1,
  result: "진행중",
  attendances: [],
  absenceApplications: [
    {
      category: "병무관계",
      startDate: "2026.05.14",
      endDate: "2026.05.20",
      reason: "예비군",
      status: "승인",
    },
  ],
};

beforeEach(() => {
  vi.mocked(useSaintAuth).mockReturnValue({
    accessToken: "access-token",
    isAuthenticated: true,
    isLoading: false,
  } as ReturnType<typeof useSaintAuth>);
  vi.mocked(useSaintChapel).mockReturnValue({
    data: chapel,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSaintChapel>);
});

describe("ChapelCard", () => {
  it("renders the rusaint seat number and absence count as occurrences", () => {
    render(<ChapelCard />);

    expect(screen.getByText("좌석번호")).toBeInTheDocument();
    expect(screen.getByText("J-5-5")).toBeInTheDocument();
    expect(screen.getByText("1회")).toBeInTheDocument();
    expect(screen.queryByText("1분")).not.toBeInTheDocument();
    expect(screen.queryByText(/번 더 가능/)).not.toBeInTheDocument();
  });

  it("shows remaining absences only when an allowed count is provided", () => {
    vi.mocked(useSaintChapel).mockReturnValue({
      data: { ...chapel, absenceAllowedMinutes: 2 },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSaintChapel>);

    render(<ChapelCard />);

    expect(screen.getByText("1회 / 최대 2회")).toBeInTheDocument();
    expect(screen.getByText("결석 1번 더 가능")).toBeInTheDocument();
  });

  it("prefers the renamed absence*Count fields when the backend sends them", () => {
    vi.mocked(useSaintChapel).mockReturnValue({
      data: {
        ...chapel,
        absenceAllowedMinutes: undefined,
        absenceUsedMinutes: undefined,
        absenceAllowedCount: 3,
        absenceUsedCount: 2,
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSaintChapel>);

    render(<ChapelCard />);

    expect(screen.getByText("2회 / 최대 3회")).toBeInTheDocument();
    expect(screen.getByText("결석 1번 더 가능")).toBeInTheDocument();
  });

  it("renders approved absence applications returned by rusaint", () => {
    render(<ChapelCard />);

    expect(screen.getByText("결석 신청 이력")).toBeInTheDocument();
    expect(screen.getByText("예비군")).toBeInTheDocument();
    expect(screen.getByText("2026.05.14 ~ 2026.05.20 · 병무관계")).toBeInTheDocument();
    expect(screen.getByText("승인")).toBeInTheDocument();
  });
});
