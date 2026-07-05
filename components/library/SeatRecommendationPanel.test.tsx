import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  LibrarySeatRecommendation,
  LibrarySeatRecommendationResponse,
} from "@/lib/api/library";
import { ApiError } from "@/lib/api/types";

vi.mock("@/lib/api/library", () => ({
  cancelWait: vi.fn(),
  confirmReservation: vi.fn(),
  getCurrentWait: vi.fn(),
  getLibrarySeatRecommendations: vi.fn(),
  prepareReservation: vi.fn(),
  registerWait: vi.fn(),
}));

// The modals make their own API calls; stub them so this suite stays focused on
// the panel's own render/interaction branches.
vi.mock("@/components/library/ReservationConfirmModal", () => ({
  ReservationConfirmModal: () => <div data-testid="confirm-modal" />,
}));
vi.mock("@/components/library/LibraryLoginModal", () => ({
  LibraryLoginModal: () => <div data-testid="login-modal" />,
}));

import { SeatRecommendationPanel } from "@/components/library/SeatRecommendationPanel";
import { getLibrarySeatRecommendations, prepareReservation } from "@/lib/api/library";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

function seat(overrides: Partial<LibrarySeatRecommendation> = {}): LibrarySeatRecommendation {
  return {
    seatId: "s-101",
    externalSeatId: "101",
    label: "A-12",
    roomCode: "R2",
    roomName: "2층 제1열람실",
    zone: null,
    seatType: null,
    audience: null,
    status: null,
    score: 1,
    matchedPreferences: [],
    missingPreferences: [],
    attributes: {
      window: true,
      outlet: true,
      standing: false,
      edge: false,
      quiet: false,
      nearEntrance: false,
    },
    note: null,
    ...overrides,
  };
}

function response(
  recommendations: LibrarySeatRecommendation[],
): LibrarySeatRecommendationResponse {
  return {
    floor: 2,
    floorLabel: "2층",
    requestedLimit: 5,
    availabilitySource: "live_per_seat",
    message: null,
    excludedRooms: [],
    warnings: [],
    recommendations,
  };
}

beforeEach(() => {
  vi.mocked(getLibrarySeatRecommendations).mockReset();
  vi.mocked(getLibrarySeatRecommendations).mockResolvedValue(response([]));
  vi.mocked(prepareReservation).mockReset();
});

describe("SeatRecommendationPanel", () => {
  it("shows empty state when no recommendations", async () => {
    render(<SeatRecommendationPanel floor={2} />, { wrapper });

    await screen.findByText(/이용 가능한 좌석이 없습니다/);
  });

  it("renders recommended seats with room name and attribute tags", async () => {
    vi.mocked(getLibrarySeatRecommendations).mockResolvedValue(response([seat()]));

    render(<SeatRecommendationPanel floor={2} />, { wrapper });

    expect(await screen.findByText("A-12")).toBeInTheDocument();
    expect(screen.getByText("2층 제1열람실")).toBeInTheDocument();
    // attributeTags joins active attribute labels with " · ".
    expect(screen.getByText("창가 · 콘센트")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "예약" })).toBeInTheDocument();
  });

  it("prepares a reservation with the numeric seat id and opens the confirm modal", async () => {
    vi.mocked(getLibrarySeatRecommendations).mockResolvedValue(response([seat()]));
    vi.mocked(prepareReservation).mockResolvedValue({} as never);

    render(<SeatRecommendationPanel floor={2} />, { wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "예약" }));

    await waitFor(() =>
      expect(prepareReservation).toHaveBeenCalledWith({ type: "RESERVE", seatId: 101 }),
    );
    expect(await screen.findByTestId("confirm-modal")).toBeInTheDocument();
  });

  it("prompts for library login when a session is required", async () => {
    vi.mocked(getLibrarySeatRecommendations).mockRejectedValue(
      new ApiError("LIBRARY_SESSION_REQUIRED", "login required", "trace-1", 401),
    );

    render(<SeatRecommendationPanel floor={2} />, { wrapper });

    expect(await screen.findByText(/도서관 로그인 후 이용할 수 있습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });

  it("surfaces an error message when preparing a reservation fails", async () => {
    vi.mocked(getLibrarySeatRecommendations).mockResolvedValue(response([seat()]));
    vi.mocked(prepareReservation).mockRejectedValue(new Error("boom"));

    render(<SeatRecommendationPanel floor={2} />, { wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "예약" }));

    expect(
      await screen.findByText(/좌석 예약 준비 중 오류가 발생했습니다/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
  });
});
