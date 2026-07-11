// Prevent Vercel edge caching so the post-SSO return always renders with the
// latest JS bundles rather than a stale cached HTML shell (same class of bug
// previously fixed for / and /chat). Route segment config is silently ignored
// in "use client" modules, so this page must stay a Server Component — the
// interactive logic lives in components/auth/AuthReturnContent.
export const dynamic = "force-dynamic";

import { Bot } from "lucide-react";
import { Suspense } from "react";

import { AuthReturnContent, PendingLine } from "@/components/auth/AuthReturnContent";

export default function AuthReturnPage() {
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
        <div className="mt-6 flex flex-col gap-3">
          <Suspense fallback={<PendingLine label="로딩 중…" />}>
            <AuthReturnContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
