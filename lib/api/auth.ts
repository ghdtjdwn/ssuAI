import { fetchJson, getApiBaseUrl } from "./client";

export interface AuthMe {
  studentId: string;
  name: string;
  major: string | null;
  enrollmentStatus: string | null;
}

export interface RefreshResponse {
  accessToken: string;
  accessTtlSeconds: number;
}

export async function refreshAccessToken(): Promise<RefreshResponse> {
  return fetchJson<RefreshResponse>("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
}

/**
 * Exchange the one-time SSO authorization code (from the backend's
 * `/auth/return?code=...` redirect) for the `ssuai_refresh` cookie via a
 * same-origin, non-redirect POST. Mirrors `refreshAccessToken`'s response
 * shape — the backend replies with the same `ApiResponse<RefreshResponse>`
 * envelope and a `Set-Cookie` on success. The code is single-use: a repeat
 * call with the same code fails with 401.
 */
export async function exchangeAuthCode(code: string): Promise<RefreshResponse> {
  return fetchJson<RefreshResponse>("/api/auth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });
}

export async function fetchMe(accessToken: string): Promise<AuthMe> {
  return fetchJson<AuthMe>("/api/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Tell the backend to clear the refresh cookie. The browser drops its
 * copy via the Set-Cookie {@code Max-Age=0} the server echoes back.
 * Best-effort: ssuAI's refresh JWTs are stateless, so this only clears
 * the cookie on the current device.
 */
export async function callLogout(): Promise<void> {
  await fetchJson<unknown>("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

/**
 * Build the absolute URL the browser should navigate to in order to
 * kick off the SmartID SSO flow. The backend's `/sso-init` endpoint
 * 302s to SmartID with `apiReturnUrl` already baked in, so the
 * frontend never has to know the SmartID URL or compose query params.
 */
export function getSsoInitUrl(): string {
  return `${getApiBaseUrl()}/api/auth/saint/sso-init`;
}

export function getLmsSsoInitUrl(): string {
  return `${getApiBaseUrl()}/api/auth/lms/sso-init`;
}
