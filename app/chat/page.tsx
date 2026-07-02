// Prevent Vercel edge caching so auth components always render with the
// latest JS bundles rather than a stale cached HTML shell.
export const dynamic = "force-dynamic";

import { ChatPanel } from "@/components/chat/ChatPanel";

export default function ChatPage() {
  // AppShell owns the chrome: 60px top bar + main padding (pt-5, pb-24 under
  // the mobile tab bar, lg:pb-10). Pin the page to the remaining viewport so
  // the thread scrolls internally and the composer stays at the bottom.
  return (
    <div className="flex h-[calc(100dvh-176px)] min-h-[24rem] flex-col lg:h-[calc(100dvh-120px)]">
      <ChatPanel />
    </div>
  );
}
