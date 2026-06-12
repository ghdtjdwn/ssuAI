import { createElement, type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LibraryReservationIntentView } from "@/lib/api/library";
import * as api from "@/lib/api/library";

import { useCurrentWait } from "./useLibraryReservation";

vi.mock("@/lib/api/library", () => ({
  cancelWait: vi.fn(),
  confirmReservation: vi.fn(),
  getCurrentWait: vi.fn(),
  prepareReservation: vi.fn(),
  registerWait: vi.fn(),
}));

function createWrapper(client: QueryClient) {
  return function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("useCurrentWait", () => {
  it("calls getCurrentWait API", async () => {
    const intent: LibraryReservationIntentView = {
      id: 1,
      status: "WAITING_FOR_SEAT",
      preferredFloor: null,
      preferredRoomIds: null,
      seatAttributes: null,
      targetSeatId: null,
      attemptCount: 0,
      nextAttemptAt: "2026-06-13T00:00:00Z",
      expiresAt: "2026-06-13T01:00:00Z",
      outcomeCode: null,
      outcomeMessage: null,
    };
    const mock = vi.mocked(api.getCurrentWait).mockResolvedValue(intent);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useCurrentWait(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(mock).toHaveBeenCalled());
  });
});
