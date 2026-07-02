"use client";

import { Megaphone } from "lucide-react";
import { Fragment } from "react";

import { getErrorStateDetails } from "@/components/shared/ErrorState";
import { useNotices } from "@/hooks/useNotices";

import { WidgetEmpty, WidgetError, WidgetFrame, WidgetSkeleton } from "./WidgetFrame";

export function NoticesWidget() {
  const { data, error, isLoading, refetch } = useNotices();
  const errorState = getErrorStateDetails(error);

  let body: React.ReactNode;
  if (isLoading) {
    body = <WidgetSkeleton lines={3} />;
  } else if (errorState) {
    body = <WidgetError onRetry={() => void refetch()} />;
  } else if (data) {
    const top = data.items.slice(0, 3);
    const more = data.items.length - top.length;
    body =
      top.length === 0 ? (
        <WidgetEmpty title="새 공지가 없어요" />
      ) : (
        <div>
          <div className="flex flex-col gap-2">
            {top.map((item, i) => (
              <Fragment key={item.link || `${item.title}-${i}`}>
                {i > 0 ? <div className="h-px bg-hairline" /> : null}
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-[12.5px] leading-normal text-foreground group-hover:text-primary">
                    {item.title}
                  </span>
                  {item.category ? (
                    <span className="shrink-0 rounded-[6px] bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary-soft-foreground">
                      {item.category}
                    </span>
                  ) : null}
                </a>
              </Fragment>
            ))}
          </div>
          {more > 0 ? (
            <p className="mt-2.5 text-[11px] font-semibold text-primary">+ {more}건 더 있어요</p>
          ) : null}
        </div>
      );
  } else {
    body = <WidgetSkeleton lines={3} />;
  }

  return (
    <WidgetFrame icon={Megaphone} title="오늘 공지">
      {body}
    </WidgetFrame>
  );
}
