import { fetchJson } from "./client";
import type { NoticeListResponse } from "./types";

export function getNotices(params?: { category?: string; page?: number }) {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.set("category", params.category);
  if (params?.page) queryParams.set("page", String(params.page));
  const query = queryParams.size ? `?${queryParams}` : "";
  return fetchJson<NoticeListResponse>(`/api/notices${query}`);
}
