import { Clock, MapPin, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CampusFacility } from "@/lib/api/types";

interface FacilityResultItemProps {
  facility: CampusFacility;
}

function joinContact(facility: CampusFacility) {
  const contacts = [facility.phone, facility.extension ? `내선 ${facility.extension}` : ""].filter(Boolean);
  return contacts.length > 0 ? contacts.join(" · ") : "연락처 없음";
}

export function FacilityResultItem({ facility }: FacilityResultItemProps) {
  return (
    <article className="rounded-[12px] border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-[13.5px] font-bold text-foreground">{facility.name}</h4>
            <Badge>{facility.categoryLabel}</Badge>
          </div>
          {facility.aliases.length > 0 ? (
            <p className="text-[11px] text-subtle">{facility.aliases.join(", ")}</p>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[7px] bg-muted px-2 py-1 font-mono text-[11px] font-bold text-muted-foreground">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {facility.location || "위치 정보 없음"}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 text-[12.5px]">
        <div className="flex gap-2">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          <dt className="sr-only">연락처</dt>
          <dd className="text-muted-foreground">{joinContact(facility)}</dd>
        </div>
        <div className="flex gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          <dt className="sr-only">운영 시간</dt>
          <dd className="space-y-0.5 text-muted-foreground">
            {facility.weekdayHours.length > 0 ? (
              <p>평일: {facility.weekdayHours.join(", ")}</p>
            ) : null}
            {facility.weekendHours.length > 0 ? (
              <p>주말: {facility.weekendHours.join(", ")}</p>
            ) : null}
            {facility.weekdayHours.length === 0 && facility.weekendHours.length === 0 ? (
              <p>운영 시간 정보 없음</p>
            ) : null}
          </dd>
        </div>
      </dl>

      {facility.notes.length > 0 ? (
        <ul className="mt-2.5 list-disc space-y-0.5 pl-5 text-[11px] text-subtle">
          {facility.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
