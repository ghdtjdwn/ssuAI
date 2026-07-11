import { Bot } from "lucide-react";
import Link from "next/link";

import { SaintLoginButton } from "@/components/auth/SaintLoginButton";

// Prevent Vercel edge caching so the post-SSO return always renders with the
// latest JS bundles rather than a stale cached HTML shell (same class of bug
// previously fixed for / and /chat).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "SmartID 로그인 · ssuAI",
};

export default function AuthLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-md animate-fadeUp rounded-card border border-hairline bg-surface p-8 shadow-e2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-primary shadow-[0_2px_8px_rgba(11,77,162,.28)]">
            <Bot size={22} className="text-white" aria-hidden />
          </span>
          <div>
            <p className="text-[15px] font-extrabold leading-tight text-foreground">ssuAI</p>
            <p className="text-[11px] leading-tight text-subtle">숭실대 어시스턴트</p>
          </div>
        </div>

        <h1 className="mt-7 text-[23px] font-bold text-foreground">SmartID 로그인</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          학교 SmartID(유세인트) 페이지에서 본인 확인 후 ssuAI 로 돌아옵니다. 시간표·성적·LMS 과제를
          한 번에 불러옵니다. ssuAI 는 학생 비밀번호를 절대 저장하지 않아요.
        </p>

        <SaintLoginButton className="mt-7 w-full" />

        <p className="mt-5 border-t border-hairline pt-4 text-xs leading-relaxed text-subtle">
          로그인하지 않아도{" "}
          <Link href="/" className="font-semibold text-primary underline underline-offset-2">
            대시보드
          </Link>{" "}
          와
          <Link
            href="/chat"
            className="ml-1 font-semibold text-primary underline underline-offset-2"
          >
            챗봇
          </Link>{" "}
          의 공개 기능 (학식, 기숙사, 시설, 도서관 좌석·도서) 은 그대로 쓸 수 있어요.
        </p>
      </div>
    </main>
  );
}
