import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryAuthProvider, useLibraryAuth } from "./LibraryAuthContext";
import { ApiError } from "@/lib/api/types";

vi.mock("@/lib/api/library", () => ({
  logoutLibrary: vi.fn().mockResolvedValue(null),
}));

const STORAGE_KEY = "library_connected";

function Harness() {
  const { credentialRevision, isConnected, markCredentialsRefreshed } = useLibraryAuth();
  return (
    <>
      <span data-testid="connected">{String(isConnected)}</span>
      <span data-testid="revision">{credentialRevision}</span>
      <button type="button" onClick={markCredentialsRefreshed}>
        refresh credentials
      </button>
    </>
  );
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LibraryAuthProvider>
        <Harness />
      </LibraryAuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

function fetchSeats(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: ["library", "seats", 2],
    queryFn: async () => ({
      floor: 2,
      floorLabel: "2층",
      totalSeats: 100,
      availableSeats: 40,
      reservedSeats: 60,
      outOfServiceSeats: 0,
      fetchedAt: "2026-07-09T10:00:00Z",
      zones: [],
    }),
  });
}

function fetchLoans(queryClient: QueryClient, queryFn: () => Promise<unknown>) {
  return queryClient.fetchQuery({ queryKey: ["library", "loans"], queryFn });
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("LibraryAuthProvider", () => {
  it("stays disconnected for anonymous visitors even when the public seats query succeeds", async () => {
    const queryClient = setup();
    expect(screen.getByTestId("connected").textContent).toBe("false");

    await act(async () => {
      await fetchSeats(queryClient);
    });

    expect(screen.getByTestId("connected").textContent).toBe("false");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("marks connected when the authenticated loans query succeeds", async () => {
    const queryClient = setup();

    await act(async () => {
      await fetchLoans(queryClient, async () => ({ total: 1, loans: [] }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected").textContent).toBe("true");
    });
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("advances the credential revision even when a fresh login stays connected", () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setup();

    expect(screen.getByTestId("connected").textContent).toBe("true");
    expect(screen.getByTestId("revision").textContent).toBe("0");

    act(() => screen.getByRole("button", { name: "refresh credentials" }).click());

    expect(screen.getByTestId("connected").textContent).toBe("true");
    expect(screen.getByTestId("revision").textContent).toBe("1");
  });

  it("marks disconnected when the loans query fails with LIBRARY_SESSION_REQUIRED", async () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    const queryClient = setup();
    expect(screen.getByTestId("connected").textContent).toBe("true");

    await act(async () => {
      await fetchLoans(queryClient, async () => {
        throw new ApiError("LIBRARY_SESSION_REQUIRED", "login required", "trace-1", 401);
      }).catch(() => {});
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected").textContent).toBe("false");
    });
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("marks disconnected when the loans query fails with a plain 401 status", async () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    const queryClient = setup();

    await act(async () => {
      await fetchLoans(queryClient, async () => {
        throw new ApiError("UNAUTHORIZED", "unauthorized", "trace-2", 401);
      }).catch(() => {});
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected").textContent).toBe("false");
    });
  });

  it("keeps the connected state on transient loans failures (e.g. 500)", async () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    const queryClient = setup();

    await act(async () => {
      await fetchLoans(queryClient, async () => {
        throw new ApiError("INTERNAL_ERROR", "upstream down", "trace-3", 500);
      }).catch(() => {});
    });

    expect(screen.getByTestId("connected").textContent).toBe("true");
  });
});
