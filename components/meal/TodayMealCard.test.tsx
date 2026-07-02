import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render-with-providers";
import { getTodayMeal } from "@/lib/api/meal";
import { ApiError, type MealResponse } from "@/lib/api/types";

import { TodayMealCard } from "./TodayMealCard";

vi.mock("@/lib/api/meal", () => ({
  getTodayMeal: vi.fn(),
}));

const mockTodayMeal: MealResponse = {
  date: "2026-05-09",
  meals: [
    {
      restaurant: "Mock 학생식당",
      type: "LUNCH",
      corner: "한식",
      menu: ["김치찌개", "쌀밥"],
    },
  ],
  closures: [],
};

beforeEach(() => {
  vi.mocked(getTodayMeal).mockReset();
});

describe("TodayMealCard", () => {
  it("renders loading skeletons while the meal query is pending", () => {
    vi.mocked(getTodayMeal).mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<TodayMealCard />);

    expect(screen.getByText("오늘의 학식")).toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton-shimmer")).toHaveLength(3);
  });

  it("renders today's meal when the query succeeds", async () => {
    vi.mocked(getTodayMeal).mockResolvedValue(mockTodayMeal);

    renderWithProviders(<TodayMealCard />);

    expect(await screen.findByText("Mock 학생식당")).toBeInTheDocument();
    expect(screen.getByText("한식")).toBeInTheDocument();
    expect(screen.getByText("김치찌개, 쌀밥")).toBeInTheDocument();
    expect(screen.getByText("점심")).toBeInTheDocument();
  });

  it("renders the error state when the query fails", async () => {
    vi.mocked(getTodayMeal).mockRejectedValue(
      new ApiError("CONNECTOR_TIMEOUT", "Timed out", "trace-1", 504),
    );

    renderWithProviders(<TodayMealCard />);

    expect(await screen.findByText("응답이 너무 오래 걸렸습니다. 잠시 후 다시 시도해주세요.")).toBeInTheDocument();
    expect(screen.getByText("CONNECTOR_TIMEOUT")).toBeInTheDocument();
    expect(screen.getByText("traceId: trace-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
