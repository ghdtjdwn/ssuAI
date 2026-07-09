import { afterEach, describe, expect, it } from "vitest";

import { getLibrarySeatEventsUrl } from "./useLibrarySeatSse";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
  delete process.env.NEXT_PUBLIC_SSUAI_API_BASE;
});

describe("getLibrarySeatEventsUrl", () => {
  it("targets the backend origin when configured", () => {
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN = "https://backend.example.com/";

    expect(getLibrarySeatEventsUrl(5)).toBe(
      "https://backend.example.com/api/library/seats/events?floor=5",
    );
  });

  it("falls back to the same-origin proxy when no backend origin is configured", () => {
    expect(getLibrarySeatEventsUrl(2)).toBe("/api/library/seats/events?floor=2");
  });
});
