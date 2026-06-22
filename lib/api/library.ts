import { fetchJson } from "./client";
import type { LibraryBookSearchResponse, LibraryFloorCode, LibraryLoansResponse, LibrarySeatStatusResponse } from "./types";

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

export function getLibrarySeatStatus(floor: LibraryFloorCode) {
  return fetchJson<LibrarySeatStatusResponse>(`/api/library/seats?floor=${floor}`, {
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

export interface LibrarySeatRecommendation {
  externalSeatId: number;
  seatId: string;
  label: string;
  roomName: string;
  floor: number;
  attributes: string[];
}

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
  expiresAt: string;
}

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
  return fetchJson<LibrarySeatRecommendation[]>(`/api/library/reservations/recommend?${params}`, {
    credentials: "include",
  });
}

export function prepareReservation(req: LibraryReservationPrepareRequest) {
  return fetchJson<LibraryReservationPrepareResponse>("/api/library/reservations/prepare", {
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

export function getMyLibrarySeat() {
  return fetchJson<unknown>("/api/library/reservations/my-seat", {
    credentials: "include",
  });
}
