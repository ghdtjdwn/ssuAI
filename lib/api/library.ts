import { z } from "zod";

import { fetchJson } from "./client";
import { fetchJsonParsed } from "./schema";
import type {
  LibraryBookSearchResponse,
  LibraryFloorCode,
  LibraryLoansResponse,
  LibrarySeatItem,
  LibrarySeatStatusResponse,
  LibrarySeatZone,
} from "./types";

export interface McpLibraryCallbackRequest {
  state: string;
  loginId: string;
  password: string;
}

export function completeMcpLibraryAuth(req: McpLibraryCallbackRequest) {
  return fetchJson<null>("/api/mcp/auth/library/callback", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Runtime response schemas (ADR 0010 §5 follow-up): validate the envelope-unwrapped
// payload of the highest-risk library endpoints at the network boundary. Schemas are
// loose objects, so ADDITIVE backend fields never break the client; annotating each
// schema as `z.ZodType<Interface>` keeps it from drifting away from the TS contract.

const librarySeatItemSchema: z.ZodType<LibrarySeatItem> = z.looseObject({
  id: z.string(),
  label: z.string(),
  status: z.enum(["available", "occupied", "outOfService"]),
});

const librarySeatZoneSchema: z.ZodType<LibrarySeatZone> = z.looseObject({
  label: z.string(),
  total: z.number(),
  available: z.number(),
  seatIds: z.array(z.string()),
  seats: z.array(librarySeatItemSchema),
});

export const librarySeatStatusResponseSchema: z.ZodType<LibrarySeatStatusResponse> = z.looseObject({
  floor: z.literal([2, 5, 6]),
  floorLabel: z.string(),
  totalSeats: z.number(),
  availableSeats: z.number(),
  reservedSeats: z.number(),
  outOfServiceSeats: z.number(),
  fetchedAt: z.string(),
  zones: z.array(librarySeatZoneSchema),
});

export function getLibrarySeatStatus(floor: LibraryFloorCode) {
  return fetchJsonParsed(`/api/library/seats?floor=${floor}`, librarySeatStatusResponseSchema, {
    credentials: "include",
  });
}

export function loginLibrary(loginId: string, password: string) {
  return fetchJson<null>("/api/library/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ loginId, password }),
  });
}

export function searchLibraryBooks(query: string, page = 0, size = 10) {
  const params = new URLSearchParams({ query, page: String(page), size: String(size) });
  return fetchJson<LibraryBookSearchResponse>(`/api/library/books?${params.toString()}`);
}

export function getLibraryLoans() {
  return fetchJson<LibraryLoansResponse>("/api/library/loans", { credentials: "include" });
}

export function logoutLibrary() {
  return fetchJson<null>("/api/library/session", {
    method: "DELETE",
    credentials: "include",
  });
}

// --- Reservation types ---

export interface LibrarySeatAttributes {
  window: boolean;
  outlet: boolean;
  standing: boolean;
  edge: boolean;
  quiet: boolean;
  nearEntrance: boolean;
}

export interface LibrarySeatRecommendation {
  seatId: string;
  /** Numeric-string external seat id — the value `prepare`'s numeric seatId expects. */
  externalSeatId: string;
  label: string;
  roomCode: string;
  roomName: string;
  zone: string | null;
  seatType: string | null;
  audience: string | null;
  status: string | null;
  score: number;
  matchedPreferences: string[];
  missingPreferences: string[];
  attributes: LibrarySeatAttributes | null;
  note: string | null;
}

export interface LibrarySeatRecommendationResponse {
  floor: number;
  floorLabel: string;
  requestedLimit: number;
  availabilitySource: string;
  message: string | null;
  excludedRooms: string[];
  warnings: string[];
  recommendations: LibrarySeatRecommendation[];
}

const librarySeatAttributesSchema: z.ZodType<LibrarySeatAttributes> = z.looseObject({
  window: z.boolean(),
  outlet: z.boolean(),
  standing: z.boolean(),
  edge: z.boolean(),
  quiet: z.boolean(),
  nearEntrance: z.boolean(),
});

const librarySeatRecommendationSchema: z.ZodType<LibrarySeatRecommendation> = z.looseObject({
  seatId: z.string(),
  externalSeatId: z.string(),
  label: z.string(),
  roomCode: z.string(),
  roomName: z.string(),
  zone: z.string().nullable(),
  seatType: z.string().nullable(),
  audience: z.string().nullable(),
  status: z.string().nullable(),
  score: z.number(),
  matchedPreferences: z.array(z.string()),
  missingPreferences: z.array(z.string()),
  attributes: librarySeatAttributesSchema.nullable(),
  note: z.string().nullable(),
});

export const librarySeatRecommendationResponseSchema: z.ZodType<LibrarySeatRecommendationResponse> =
  z.looseObject({
    floor: z.number(),
    floorLabel: z.string(),
    requestedLimit: z.number(),
    availabilitySource: z.string(),
    message: z.string().nullable(),
    excludedRooms: z.array(z.string()),
    warnings: z.array(z.string()),
    recommendations: z.array(librarySeatRecommendationSchema),
  });

export type ReservationType = "RESERVE" | "CANCEL" | "SWAP";

export interface LibraryReservationPrepareRequest {
  type: ReservationType;
  seatId?: number;
  targetSeatId?: number;
}

export interface LibraryReservationPrepareResponse {
  actionId: number;
  actionType: string;
  summary: string;
  /** ISO-8601 string as sent by the backend — validated as string, never coerced. */
  expiresAt: string;
}

export const libraryReservationPrepareResponseSchema: z.ZodType<LibraryReservationPrepareResponse> =
  z.looseObject({
    actionId: z.number(),
    actionType: z.string(),
    summary: z.string(),
    expiresAt: z.string(),
  });

export interface LibraryReservationConfirmResponse {
  status: "SUCCESS" | "PROCESSING" | "FAILED_RACE" | "TIMEOUT" | "FAILED_AUTH" | "FAILED_UPSTREAM";
  intentId: number | null;
  message: string;
}

export interface LibraryWaitRequest {
  preferredFloor?: string;
  preferredRoomIds?: string;
  seatAttributes?: string;
  targetSeatId?: number;
}

export interface LibraryReservationIntentView {
  id: number;
  status: string;
  preferredFloor: string | null;
  preferredRoomIds: string | null;
  seatAttributes: string | null;
  targetSeatId: number | null;
  attemptCount: number;
  nextAttemptAt: string;
  expiresAt: string;
  outcomeCode: string | null;
  outcomeMessage: string | null;
}

// --- API functions ---

export function getLibrarySeatRecommendations(
  floor: LibraryFloorCode,
  roomIds?: string,
  attributes?: string,
) {
  const params = new URLSearchParams({ floor: String(floor) });
  if (roomIds) params.set("roomIds", roomIds);
  if (attributes) params.set("attributes", attributes);
  return fetchJsonParsed(
    `/api/library/reservations/recommend?${params}`,
    librarySeatRecommendationResponseSchema,
    {
      credentials: "include",
    },
  );
}

export function prepareReservation(req: LibraryReservationPrepareRequest) {
  return fetchJsonParsed("/api/library/reservations/prepare", libraryReservationPrepareResponseSchema, {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(req),
  });
}

export function confirmReservation() {
  return fetchJson<LibraryReservationConfirmResponse>("/api/library/reservations/confirm", {
    method: "POST",
    credentials: "include",
  });
}

export function registerWait(req: LibraryWaitRequest) {
  return fetchJson<LibraryReservationIntentView>("/api/library/reservations/wait", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(req),
  });
}

export function getCurrentWait() {
  return fetchJson<LibraryReservationIntentView>("/api/library/reservations/wait/current", {
    credentials: "include",
  });
}

export function cancelWait() {
  return fetchJson<LibraryReservationIntentView>("/api/library/reservations/wait", {
    method: "DELETE",
    credentials: "include",
  });
}

