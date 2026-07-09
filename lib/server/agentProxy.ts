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
 *
 * `principal` handling (ssuAgent ADR 0011 companion, P1-8b): `principal` binds thread
 * ownership to a stable subject instead of the rotating `mcp_session_id`. Per ADR
 * 0011's trust model, `principal` must NEVER be client-assertable — only this
 * server-side proxy may set it. So every request body is stripped of any client-sent
 * `principal` before forwarding, then `deriveServerPrincipal` re-injects it ONLY from
 * a source this server itself has verified. See docs/adr/0086-server-side-principal.md
 * for why `deriveServerPrincipal` returns null today (dormant, strip-only).
 */
const SSUAGENT_BASE =
  process.env.SSUAGENT_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SSUAGENT_BASE_URL?.trim() ||
  "https://ssuagent.duckdns.org";

/**
 * Derive a server-verified stable principal for the caller of this request, if one
 * exists. MUST NEVER read `principal` (or any other identity claim) out of the
 * request body — that value is client-asserted and is stripped, never trusted.
 *
 * Today this always returns null: this Next.js server has no server-verified
 * identity available at this route. The SmartID access JWT lives only in browser
 * memory (`useSaintAuth`) and is never attached to the `/api/agent/*` fetch calls
 * (`lib/api/agent.ts` sends no `Authorization` header), and the httpOnly refresh
 * cookie set in `proxy.ts` is scoped to `Path=/api/auth`, so browsers never send it
 * on `/api/agent/*` requests either — there is nothing here to verify. Wiring this
 * live requires a follow-up (e.g. attach `Authorization: Bearer <accessToken>` from
 * `lib/api/agent.ts` and verify it here against ssuMCP, or widen the refresh cookie's
 * path) that is out of scope for this unit; see the ADR note for details.
 */
export function deriveServerPrincipal(request: Request): string | null {
  void request; // no server-verified identity source reaches this route yet (see comment above)
  return null;
}

/**
 * Strip any client-sent `principal` key from a raw JSON request body, then inject
 * `serverPrincipal` (if non-null). Never trusts the body's own `principal` value.
 *
 * Pure and side-effect-free so it is unit-testable without mocking `fetch` or
 * `Request`. If `rawBody` is not a JSON object (malformed, array, primitive), it is
 * returned unchanged — ssuAgent's own request validation rejects malformed bodies.
 */
export function stripAndInjectPrincipal(rawBody: string, serverPrincipal: string | null): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return rawBody;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return rawBody;
  }

  const sanitized = parsed as Record<string, unknown>;
  delete sanitized.principal;
  if (serverPrincipal) {
    sanitized.principal = serverPrincipal;
  }

  return JSON.stringify(sanitized);
}

export async function proxyToAgent(path: string, request: Request): Promise<Response> {
  const rawBody = await request.text();
  const body = stripAndInjectPrincipal(rawBody, deriveServerPrincipal(request));

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
