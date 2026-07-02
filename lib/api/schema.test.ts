import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getLibrarySeatRecommendations,
  librarySeatRecommendationResponseSchema,
  type LibrarySeatRecommendationResponse,
} from "./library";
import { ApiSchemaError, fetchJsonParsed } from "./schema";

function stubFetchEnvelope(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        data,
        error: null,
        traceId: "trace-schema",
      }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const validResponse: LibrarySeatRecommendationResponse = {
  floor: 2,
  floorLabel: "2층 제1열람실",
  requestedLimit: 5,
  availabilitySource: "REALTIME",
  message: null,
  excludedRooms: [],
  warnings: [],
  recommendations: [
    {
      seatId: "seat-1",
      externalSeatId: "1234",
      label: "A-12",
      roomCode: "R1",
      roomName: "제1열람실",
      zone: null,
      seatType: null,
      audience: null,
      status: "AVAILABLE",
      score: 0.92,
      matchedPreferences: ["window"],
      missingPreferences: [],
      attributes: {
        window: true,
        outlet: false,
        standing: false,
        edge: true,
        quiet: true,
        nearEntrance: false,
      },
      note: null,
    },
  ],
};

describe("fetchJsonParsed", () => {
  it("passes a valid payload through unchanged", async () => {
    stubFetchEnvelope(validResponse);

    await expect(
      fetchJsonParsed("/api/library/reservations/recommend?floor=2", librarySeatRecommendationResponseSchema),
    ).resolves.toEqual(validResponse);
  });

  it("fails loudly when the payload is a bare array instead of the envelope (the historical regression)", async () => {
    stubFetchEnvelope(validResponse.recommendations);

    const promise = getLibrarySeatRecommendations(2);
    await expect(promise).rejects.toBeInstanceOf(ApiSchemaError);
    await expect(promise).rejects.toThrow(
      /Response schema mismatch for \/api\/library\/reservations\/recommend/,
    );
    await expect(promise).rejects.toThrow(/expected object, received array/);
  });

  it("names the offending field path in the error message", async () => {
    stubFetchEnvelope({
      ...validResponse,
      recommendations: [{ ...validResponse.recommendations[0], score: "high" }],
    });

    await expect(getLibrarySeatRecommendations(2)).rejects.toThrow(/recommendations\.0\.score/);
  });

  it("passes additive unknown fields through without failing", async () => {
    const withAdditiveFields = {
      ...validResponse,
      upstreamLatencyMs: 42,
      recommendations: [{ ...validResponse.recommendations[0], newBackendHint: "keep-me" }],
    };
    stubFetchEnvelope(withAdditiveFields);

    await expect(
      fetchJsonParsed("/api/library/reservations/recommend?floor=2", librarySeatRecommendationResponseSchema),
    ).resolves.toEqual(withAdditiveFields);
  });
});
