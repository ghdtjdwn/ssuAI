import { isValidAgentId, proxyToAgent } from "@/lib/server/agentProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ threadId: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const { threadId } = await context.params;
  if (!isValidAgentId(threadId)) {
    return Response.json({ error: "Invalid thread_id" }, { status: 422 });
  }
  return proxyToAgent(`/agent/threads/${encodeURIComponent(threadId)}`, request);
}
