"use client";

import { X } from "lucide-react";
import { useEffect, useId } from "react";

import { cn } from "@/lib/utils";

import { Portal } from "./portal";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /**
   * "responsive": bottom sheet under lg, right slide-over from lg (home editor).
   * "bottom": always bottom sheet. "right": always slide-over.
   */
  side?: "responsive" | "bottom" | "right";
  className?: string;
}

/** Bottom sheet (mobile) / right slide-over (desktop) with backdrop + ESC close. */
export function Sheet({ open, onClose, title, children, side = "responsive", className }: SheetProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const panelBase =
    "fixed z-50 flex flex-col bg-surface shadow-e3 outline-none";
  const bottom =
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-hero animate-sheetUp pb-[env(safe-area-inset-bottom)]";
  const right = "inset-y-0 right-0 w-full max-w-md animate-slideInRight";

  const panelClass =
    side === "bottom"
      ? bottom
      : side === "right"
        ? right
        : cn(bottom, "lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:bottom-auto lg:max-h-none lg:h-dvh lg:w-full lg:max-w-md lg:rounded-none lg:animate-slideInRight");

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <div
          aria-hidden="true"
          onClick={onClose}
          className="absolute inset-0 h-full w-full cursor-default bg-black/45 animate-fadeIn"
        />
        <div className={cn(panelBase, panelClass, className)}>
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <h2 id={titleId} className="text-[15px] font-extrabold text-foreground">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="press -mr-1 flex h-10 w-10 items-center justify-center rounded-control text-muted-foreground hover:bg-muted"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
        </div>
      </div>
    </Portal>
  );
}
