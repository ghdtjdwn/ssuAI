import { fetchJson } from "./client";
import type {
  ChapelInfo,
  GradesResponse,
  GraduationStatus,
  ScheduleResponse,
  ScholarshipEntry,
} from "./types";

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function getSaintSchedule(accessToken: string) {
  return fetchJson<ScheduleResponse>("/api/saint/schedule", {
    headers: authHeader(accessToken),
  });
}

export function getSaintGrades(accessToken: string) {
  return fetchJson<GradesResponse>("/api/saint/grades", {
    headers: authHeader(accessToken),
  });
}

export function getSaintChapel(accessToken: string, year?: number, semester?: string) {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (semester) params.set("semester", semester);
  const query = params.size ? `?${params}` : "";
  return fetchJson<ChapelInfo>(`/api/saint/chapel${query}`, {
    headers: authHeader(accessToken),
  });
}

export function getSaintGraduation(accessToken: string) {
  return fetchJson<GraduationStatus>("/api/saint/graduation", {
    headers: authHeader(accessToken),
  });
}

export function getSaintScholarships(accessToken: string, year?: number) {
  const query = year ? `?year=${year}` : "";
  return fetchJson<ScholarshipEntry[]>(`/api/saint/scholarships${query}`, {
    headers: authHeader(accessToken),
  });
}
