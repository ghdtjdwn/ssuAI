import { createElement, type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LibraryReservationIntentView } from "@/lib/api/library";
import * as api from "@/lib/api/library";
import { ApiError } from "@/lib/api/types";

import { isLibraryAuthError, useCurrentWait } from "./useLibraryReservation";

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

describe("isLibraryAuthError", () => {
  it("returns true for LIBRARY_SESSION_REQUIRED code", () => {
    const err = new ApiError("LIBRARY_SESSION_REQUIRED", "msg", "t", 200);
    expect(isLibraryAuthError(err)).toBe(true);
  });

  it("returns true for 401 status", () => {
    const err = new ApiError("UNAUTHORIZED", "msg", "t", 401);
    expect(isLibraryAuthError(err)).toBe(true);
  });

  it("returns true for 404 status", () => {
    const err = new ApiError("NOT_FOUND", "msg", "t", 404);
    expect(isLibraryAuthError(err)).toBe(true);
  });

  it("returns false for non-ApiError", () => {
    expect(isLibraryAuthError(new Error("generic"))).toBe(false);
    expect(isLibraryAuthError(null)).toBe(false);
  });

  it("returns false for unrelated ApiError", () => {
    const err = new ApiError("SERVER_ERROR", "msg", "t", 500);
    expect(isLibraryAuthError(err)).toBe(false);
  });
});

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
