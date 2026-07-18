"use client";

import {
  Bot,
  Building2,
  GraduationCap,
  Home,
  BookOpen,
  MessageCircle,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSaintAuth } from "@/hooks/useSaintAuth";
import { cn } from "@/lib/utils";

import { ConnectionBadge } from "./ConnectionsPanel";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

const NAV: NavItem[] = [
  { href: "/", label: "홈", icon: Home },
  { href: "/chat", label: "챗봇", icon: MessageCircle },
  { href: "/academics", label: "학사", icon: GraduationCap },
  { href: "/library", label: "도서관", icon: BookOpen },
  { href: "/campus", label: "캠퍼스", icon: Building2 },
];

const TITLES: Record<string, string> = {
  "/": "홈",
  "/chat": "챗봇",
  "/academics": "학사",
  "/library": "도서관",
  "/campus": "캠퍼스",
  "/admin": "운영 대시보드",
};

/** "7월 2일 수요일 · 2026 여름학기" style subtitle for the top bar. */
function todayLabel(): string {
  const now = new Date();
  const date = now.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const m = now.getMonth() + 1;
  const term =
    m >= 3 && m <= 6 ? "1학기" : m >= 7 && m <= 8 ? "여름학기" : m >= 9 && m <= 12 ? "2학기" : "겨울학기";
  return `${date} · ${now.getFullYear()} ${term}`;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Avatar() {
  const { user, isAuthenticated } = useSaintAuth();
  const initial = isAuthenticated && user?.name ? user.name.charAt(0) : null;
  return (
    <span
      aria-label={initial ? `${user?.name} 프로필` : "비로그인"}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-control text-[13px] font-bold",
        initial ? "bg-primary text-white" : "border border-border bg-surface text-subtle",
      )}
    >
      {initial ?? "?"}
    </span>
  );
}

function SidebarProfile() {
  const { user, isAuthenticated } = useSaintAuth();
  return (
    <div className="flex items-center gap-3 border-t border-hairline px-4 py-4">
      <Avatar />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-foreground">
          {isAuthenticated ? user?.name : "로그인 필요"}
        </p>
        <p className="truncate text-[11.5px] text-subtle">
          {isAuthenticated ? (user?.major ?? user?.studentId) : "u-SAINT 연결에서 로그인"}
        </p>
      </div>
    </div>
  );
}

/**
 * App shell: 246px sidebar + top bar on lg+, top bar + bottom tab bar below lg.
 * Auth/return popup routes render bare (no chrome).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const bare = pathname.startsWith("/auth/") || pathname.startsWith("/mcp/auth/");
  if (bare) {
    return <>{children}</>;
  }

  const title = TITLES[pathname] ?? NAV.find((n) => isActive(pathname, n.href))?.label ?? "ssuAI";

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[246px] flex-col border-r border-hairline bg-surface lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary shadow-[0_2px_8px_rgba(11,77,162,.28)]">
            <Bot size={20} className="text-white" aria-hidden />
          </span>
          <div>
            <p className="text-[15px] font-extrabold leading-tight text-foreground">ssuAI</p>
            <p className="text-[11px] leading-tight text-subtle">숭실대 어시스턴트</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 pt-2" aria-label="주 메뉴">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press flex h-[42px] items-center gap-3 rounded-[11px] px-3 text-[13.5px] transition-colors",
                  active
                    ? "bg-primary-soft font-bold text-primary-soft-foreground"
                    : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon size={20} aria-hidden strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            );
          })}
        </nav>
        <SidebarProfile />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[246px]">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-hairline bg-background/85 backdrop-blur">
          <div className="flex h-[60px] items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {/* Mobile logo */}
              <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary lg:hidden">
                <Bot size={19} className="text-white" aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-extrabold leading-tight text-foreground">
                  <span className="lg:hidden">ssuAI</span>
                  <span className="hidden lg:inline">{title}</span>
                </h1>
                <p className="truncate text-[11.5px] leading-tight text-subtle">{todayLabel()}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ConnectionBadge />
              <ThemeToggle />
              <Link
                href="/admin"
                title="운영 대시보드"
                aria-label="운영 대시보드"
                className="press hidden h-9 w-9 items-center justify-center rounded-control border border-border bg-surface text-muted-foreground hover:text-foreground lg:flex"
              >
                <Settings size={18} aria-hidden />
              </Link>
              <Avatar />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:pb-10">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          aria-label="하단 탭"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <div className="grid grid-cols-5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[67px] flex-col items-center justify-center gap-1 text-[12.5px]",
                    active ? "font-bold text-primary" : "font-medium text-subtle",
                  )}
                >
                  <Icon
                    size={26}
                    aria-hidden
                    strokeWidth={active ? 2.5 : 2}
                    fill={active ? "currentColor" : "none"}
                    fillOpacity={active ? 0.15 : 0}
                  />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
