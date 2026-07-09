import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMcpWebSession } from "./agent";
import { fetchMe, refreshAccessToken } from "./auth";
import { getAcademicCalendar } from "./calendar";
import { getDormThisWeekMeal } from "./dorm";
import { searchFacilities } from "./facility";
import {
  getLibraryLoans,
  getLibrarySeatStatus,
  loginLibrary,
  searchLibraryBooks,
} from "./library";
import { getTodayMeal, getWeeklyMeals } from "./meal";
import { getNotices } from "./notice";
import { getSaintSchedule } from "./saint";

const BACKEND_ORIGIN = "https://backend.example.com";

function stubEnvelope(data: unknown) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(Response.json({
      data,
      error: null,
      traceId: "trace-public-origin",
    })),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN = `${BACKEND_ORIGIN}/`;
  delete process.env.NEXT_PUBLIC_SSUAI_API_BASE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
  delete process.env.NEXT_PUBLIC_SSUAI_API_BASE;
});

describe("public-origin API helpers", () => {
  it("targets the backend origin for anonymous REST reads", async () => {
    const fetchMock = stubEnvelope({});
    const cases: Array<[() => Promise<unknown>, string]> = [
      [() => getTodayMeal(), "/api/meals/today"],
      [() => getWeeklyMeals("2026-07-06"), "/api/meals/weekly?startDate=2026-07-06"],
      [() => getNotices({ category: "학사", page: 2 }), "/api/notices?category=%ED%95%99%EC%82%AC&page=2"],
      [() => searchFacilities("형남"), "/api/campus/facilities?query=%ED%98%95%EB%82%A8"],
      [() => getDormThisWeekMeal(), "/api/dorm/meals/this-week"],
      [() => searchLibraryBooks("database", 1, 5), "/api/library/books?query=database&page=1&size=5"],
    ];

    for (const [call, path] of cases) {
      fetchMock.mockClear();
      await call();
      expect(fetchMock).toHaveBeenCalledWith(
        `${BACKEND_ORIGIN}${path}`,
        expect.objectContaining({
          credentials: "omit",
          headers: expect.any(Headers),
        }),
      );
    }
  });

  it("targets the backend origin for parsed public seat status and calendar reads", async () => {
    const fetchMock = stubEnvelope({
      floor: 2,
      floorLabel: "2층",
      totalSeats: 10,
      availableSeats: 6,
      reservedSeats: 3,
      outOfServiceSeats: 1,
      fetchedAt: "2026-07-10T00:00:00Z",
      zones: [],
    });
    await getLibrarySeatStatus(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BACKEND_ORIGIN}/api/library/seats?floor=2`,
      expect.objectContaining({
        credentials: "omit",
        headers: expect.any(Headers),
      }),
    );

    fetchMock.mockResolvedValueOnce(
      Response.json({
        data: {
          year: 2026,
          events: [{ date: "2026-07-10", event: "종강", category: "" }],
        },
        error: null,
        traceId: "trace-public-origin",
      }),
    );
    await getAcademicCalendar(2026);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BACKEND_ORIGIN}/api/academic-calendar?year=2026`,
      expect.objectContaining({
        credentials: "omit",
        headers: expect.any(Headers),
      }),
    );
  });

  it("keeps cookie and bearer-token helpers on same-origin proxy paths", async () => {
    const fetchMock = stubEnvelope({
      accessToken: "access-token",
      accessTtlSeconds: 900,
    });

    await refreshAccessToken();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/refresh",
      expect.objectContaining({ credentials: "include" }),
    );

    fetchMock.mockImplementation(() =>
      Promise.resolve(Response.json({
        data: {},
        error: null,
        traceId: "trace-public-origin",
      })),
    );

    const cases: Array<[() => Promise<unknown>, string]> = [
      [() => fetchMe("access-token"), "/api/auth/me"],
      [() => getSaintSchedule("access-token"), "/api/saint/schedule"],
      [() => loginLibrary("student", "encrypted"), "/api/library/login"],
      [() => getLibraryLoans(), "/api/library/loans"],
      [() => createMcpWebSession("access-token"), "/api/mcp/auth/web-session"],
    ];

    for (const [call, path] of cases) {
      fetchMock.mockClear();
      await call();
      expect(fetchMock).toHaveBeenCalledWith(
        path,
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );
    }
  });
});
