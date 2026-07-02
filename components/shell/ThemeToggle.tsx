"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** Light/dark toggle following the system by default (next-themes). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // next-themes resolves the theme only on the client; render a stable
  // placeholder until hydrated to avoid a hydration mismatch.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title="테마"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="press flex h-9 w-9 items-center justify-center rounded-control border border-border bg-surface text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />}
    </button>
  );
}
