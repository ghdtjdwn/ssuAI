// Prevent Vercel edge caching so auth components always render with the
// latest JS bundles rather than a stale cached HTML shell.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { ChatPanel } from "@/components/chat/ChatPanel";

export const metadata: Metadata = {
  title: "챗봇",
};

export default function ChatPage() {
  // AppShell owns the chrome around the mobile tab bar. Include the device
  // safe area and let short keyboard viewports shrink below the desktop-only
  // minimum height so the composer remains visible.
  return (
    <div className="flex h-[calc(100dvh-176px-env(safe-area-inset-bottom))] min-h-0 flex-col lg:h-[calc(100dvh-120px)] lg:min-h-[24rem]">
      <ChatPanel />
    </div>
  );
}
