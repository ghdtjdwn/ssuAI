/**
 * Server-side proxy to ssuAgent's `/agent/*` SSE endpoints.
 *
 * The browser used to call ssuAgent directly via NEXT_PUBLIC_SSUAGENT_BASE_URL, which
 * means an API key could never be added without exposing it to the client. These Next
 * route handlers run on the server, inject the `X-Agent-Key` credential from a
 * server-only env var, and stream the SSE response straight back to the browser, which
 * now calls the same-origin `/api/agent/*` routes instead (security follow-up #11).
 *
 * Rollout is safe and incremental: when AGENT_API_KEY is unset no header is sent and
 * ssuAgent's gate is a no-op (current behavior). Setting the matching key on both this
 * app and ssuAgent then activates enforcement without any code change.
 */
const SSUAGENT_BASE =
  process.env.SSUAGENT_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SSUAGENT_BASE_URL?.trim() ||
  "https://ssuagent.duckdns.org";

export async function proxyToAgent(path: string, request: Request): Promise<Response> {
  const body = await request.text();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.AGENT_API_KEY?.trim();
  if (key) {
    headers["X-Agent-Key"] = key;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${SSUAGENT_BASE}${path}`, {
      method: "POST",
      headers,
      body,
    });
  } catch {
    return new Response(`data: ${JSON.stringify({ type: "error", message: "ssuAgent unreachable" })}\n\n`, {
      status: 502,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
