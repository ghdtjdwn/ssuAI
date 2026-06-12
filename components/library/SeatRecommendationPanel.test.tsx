import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";

vi.mock("@/lib/api/library", () => ({
  cancelWait: vi.fn(),
  confirmReservation: vi.fn(),
  getCurrentWait: vi.fn(),
  getLibrarySeatRecommendations: vi.fn().mockResolvedValue([]),
  prepareReservation: vi.fn(),
  registerWait: vi.fn(),
}));

import { SeatRecommendationPanel } from "@/components/library/SeatRecommendationPanel";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

describe("SeatRecommendationPanel", () => {
  it("shows empty state when no recommendations", async () => {
    render(<SeatRecommendationPanel floor={2} />, { wrapper });

    await screen.findByText(/이용 가능한 좌석이 없습니다/);
  });
});
