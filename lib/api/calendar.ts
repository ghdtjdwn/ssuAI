import { z } from "zod";

import { fetchJsonParsed } from "./schema";

export interface AcademicCalendarEvent {
  /** ISO yyyy-MM-dd. */
  date: string;
  event: string;
  /** May be empty — the real connector does not categorize events. */
  category: string;
}

export interface AcademicCalendarResponse {
  year: number;
  events: AcademicCalendarEvent[];
}

const academicCalendarEventSchema: z.ZodType<AcademicCalendarEvent> = z.looseObject({
  date: z.string(),
  event: z.string(),
  category: z.string(),
});

const academicCalendarResponseSchema: z.ZodType<AcademicCalendarResponse> = z.looseObject({
  year: z.number(),
  events: z.array(academicCalendarEventSchema),
});

export function getAcademicCalendar(year?: number) {
  const query = year ? `?year=${year}` : "";
  return fetchJsonParsed(`/api/academic-calendar${query}`, academicCalendarResponseSchema);
}
