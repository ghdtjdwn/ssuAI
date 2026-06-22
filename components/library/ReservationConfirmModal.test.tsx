import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render-with-providers";
import { confirmReservation } from "@/lib/api/library";
import type {
  LibraryReservationConfirmResponse,
  LibraryReservationPrepareResponse,
} from "@/lib/api/library";

import { ReservationConfirmModal } from "./ReservationConfirmModal";

vi.mock("@/lib/api/library", () => ({
  confirmReservation: vi.fn(),
}));

const pendingAction: LibraryReservationPrepareResponse = {
  actionId: 1,
  actionType: "RESERVE",
  summary: "3층 A-1 좌석 예약",
  expiresAt: "2026-06-22T10:00:00.000Z",
};

function renderModal() {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  renderWithProviders(
    <ReservationConfirmModal
      pendingAction={pendingAction}
      onClose={onClose}
      onSuccess={onSuccess}
    />,
  );
  return { onClose, onSuccess };
}

beforeEach(() => {
  vi.mocked(confirmReservation).mockReset();
});

describe("ReservationConfirmModal", () => {
  it("treats PROCESSING as an in-progress (non-error) outcome and refreshes/closes", async () => {
    vi.mocked(confirmReservation).mockResolvedValue({
      status: "PROCESSING",
      intentId: 42,
      message: "백그라운드 처리 중",
    } satisfies LibraryReservationConfirmResponse);

    const { onClose, onSuccess } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "예약 확정" }));

    expect(
      await screen.findByText(
        "예약을 백그라운드에서 처리 중이에요. 잠시 후 좌석 상태를 확인해주세요.",
      ),
    ).toBeInTheDocument();
    // PROCESSING must NOT render the failure path.
    expect(screen.queryByText(/예약 실패/)).not.toBeInTheDocument();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the success message and refreshes/closes on SUCCESS", async () => {
    vi.mocked(confirmReservation).mockResolvedValue({
      status: "SUCCESS",
      intentId: 7,
      message: "ok",
    } satisfies LibraryReservationConfirmResponse);

    const { onClose, onSuccess } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "예약 확정" }));

    expect(await screen.findByText("예약이 완료되었습니다.")).toBeInTheDocument();
    expect(screen.queryByText(/예약 실패/)).not.toBeInTheDocument();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the failure message and does not close on a genuine failure", async () => {
    vi.mocked(confirmReservation).mockResolvedValue({
      status: "FAILED_RACE",
      intentId: null,
      message: "이미 다른 사용자가 예약함",
    } satisfies LibraryReservationConfirmResponse);

    const { onClose, onSuccess } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "예약 확정" }));

    expect(
      await screen.findByText("예약 실패: 이미 다른 사용자가 예약함"),
    ).toBeInTheDocument();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
