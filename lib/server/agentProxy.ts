import { createHmac } from "node:crypto";

/**
 * Server-side proxy to ssuAgent's `/agent/*` SSE endpoints.
 *
 * The browser used to call ssuAgent directly via NEXT_PUBLIC_SSUAGENT_BASE_URL, which
 * means an API key could never be added without exposing it to the client. These Next
 * route handlers run on the server, inject the `X-Agent-Key` credential from a
 * server-only env var, and stream the SSE response straight back to the browser, which
 * now calls the same-origin `/api/agent/*` routes instead (security follow-up #11).
 *
 * Production configures the same AGENT_API_KEY on this app and ssuAgent so only this
 * trusted server boundary can assert a principal. Local development may omit the key
 * while ssuAgent's matching development gate is disabled.
 *
 * `principal` handling (ssuAgent ADR 0011 companion, P1-8b): `principal` binds thread
 * ownership to a stable subject instead of the rotating `mcp_session_id`. Per ADR
 * 0011's trust model, `principal` must NEVER be client-assertable — only this
 * server-side proxy may set it. So every request body is stripped of any client-sent
 * `principal` before forwarding, then `deriveServerPrincipal` re-injects it ONLY from
 * a source this server itself has verified. The browser provides its short-lived
 * access token only to this same-origin route; this server verifies it with
 * ssuMCP and forwards only the verified subject to ssuAgent.
 */
const SSUAGENT_BASE =
  process.env.SSUAGENT_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SSUAGENT_BASE_URL?.trim() ||
  "https://ssuagent.duckdns.org";

const SSUMCP_BASE = (
  process.env.SSUAI_API_PROXY_TARGET?.trim() ||
  process.env.NEXT_PUBLIC_SSUAI_API_BASE?.trim() ||
  "http://localhost:8080"
).replace(/\/$/, "");

const PRINCIPAL_VERIFICATION_TIMEOUT_MS = 3_000;
export const AGENT_MAX_REQUEST_BYTES = 32_768;
const AGENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function isValidAgentId(value: string): boolean {
  return AGENT_ID_PATTERN.test(value);
}

class PrincipalVerificationError extends Error {
  constructor(
    readonly status: 401 | 503,
    message: string,
  ) {
    super(message);
    this.name = "PrincipalVerificationError";
  }
}

/**
 * Derive a server-verified stable principal for the caller of this request, if one
 * exists. MUST NEVER read `principal` (or any other identity claim) out of the
 * request body — that value is client-asserted and is stripped, never trusted.
 *
 * The bearer token is never sent to ssuAgent. It is accepted only by this
 * same-origin server route and verified with ssuMCP's authenticated `/api/auth/me`
 * endpoint. A request without a bearer token uses the existing session-scoped
 * owner. Once a bearer token is presented, verification is fail-closed: an expired
 * token returns 401 and verifier failure returns 503 instead of silently changing
 * the thread's ownership tier.
 */
export async function deriveServerPrincipal(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const response = await fetch(`${SSUMCP_BASE}/api/auth/me`, {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(PRINCIPAL_VERIFICATION_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) {
      throw new PrincipalVerificationError(401, "Authentication expired");
    }
    if (!response.ok) {
      throw new PrincipalVerificationError(503, "Authentication verifier unavailable");
    }

    const body = (await response.json()) as { data?: { studentId?: unknown } };
    if (typeof body.data?.studentId !== "string" || body.data.studentId.length === 0) {
      throw new PrincipalVerificationError(503, "Authentication verifier returned an invalid subject");
    }
    return body.data.studentId;
  } catch (error) {
    if (error instanceof PrincipalVerificationError) throw error;
    throw new PrincipalVerificationError(503, "Authentication verifier unavailable");
  }
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

function invalidPayload(message: string, status = 422): Response {
  return Response.json({ error: message }, { status });
}

export function validateAgentPayload(rawBody: string): Response | null {
  if (new TextEncoder().encode(rawBody).byteLength > AGENT_MAX_REQUEST_BYTES) {
    return invalidPayload("Request body too large", 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return invalidPayload("Malformed JSON", 400);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return invalidPayload("JSON object required");
  }

  const body = parsed as Record<string, unknown>;
  const threadId = body.thread_id;
  if (
    threadId !== undefined &&
    (typeof threadId !== "string" || (threadId !== "" && !isValidAgentId(threadId)))
  ) {
    return invalidPayload("Invalid thread_id");
  }
  const sessionId = body.mcp_session_id;
  if (
    sessionId !== undefined &&
    sessionId !== null &&
    (typeof sessionId !== "string" || !isValidAgentId(sessionId))
  ) {
    return invalidPayload("Invalid mcp_session_id");
  }
  return null;
}

function signedClientIdentity(
  request: Request,
  serverPrincipal: string | null,
  key: string,
): { id: string; signature: string } {
  // Vercel overwrites its platform header at the trusted edge. Prefer it over
  // the generic forwarding chain, which a direct client can conflict with.
  const clientIp =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const source = serverPrincipal ? `principal:${serverPrincipal}` : `ip:${clientIp}`;
  const id = createHmac("sha256", key).update(source).digest("hex");
  const signature = createHmac("sha256", key).update(`v1:${id}`).digest("hex");
  return { id, signature };
}

export async function proxyToAgent(path: string, request: Request): Promise<Response> {
  const key = process.env.AGENT_API_KEY?.trim();
  if (!key && process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "Agent proxy authentication is unavailable" }, { status: 503 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      return invalidPayload("Invalid Content-Length", 400);
    }
    if (declaredLength > AGENT_MAX_REQUEST_BYTES) {
      return invalidPayload("Request body too large", 413);
    }
  }
  const rawBody = await request.text();
  const payloadError = validateAgentPayload(rawBody);
  if (payloadError) return payloadError;

  let serverPrincipal: string | null;
  try {
    serverPrincipal = await deriveServerPrincipal(request);
  } catch (error) {
    if (error instanceof PrincipalVerificationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const body = stripAndInjectPrincipal(rawBody, serverPrincipal);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) {
    headers["X-Agent-Key"] = key;
    const clientIdentity = signedClientIdentity(request, serverPrincipal, key);
    headers["X-Agent-Client-Id"] = clientIdentity.id;
    headers["X-Agent-Client-Signature"] = clientIdentity.signature;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${SSUAGENT_BASE}${path}`, {
      method: request.method,
      headers,
      body,
    });
  } catch {
    return new Response(`data: ${JSON.stringify({ type: "error", message: "ssuAgent unreachable" })}\n\n`, {
      status: 502,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
    });
  }

  const responseHeaders: Record<string, string> = {
    "Cache-Control": "no-cache, no-transform",
  };
  const contentType = upstream.headers.get("Content-Type");
  if (contentType) responseHeaders["Content-Type"] = contentType;
  else if (request.method === "POST") responseHeaders["Content-Type"] = "text/event-stream";

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
