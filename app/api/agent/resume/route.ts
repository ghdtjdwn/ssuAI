import { proxyToAgent } from "@/lib/server/agentProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Agent turns stream for a while (multi-step tool calls); let the proxy function live
// long enough not to cut the SSE stream. 60s is the Hobby max; raise to 300 on Pro.
export const maxDuration = 60;

export function POST(request: Request) {
  return proxyToAgent("/agent/resume", request);
}
