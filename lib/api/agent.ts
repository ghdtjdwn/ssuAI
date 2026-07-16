import { fetchJson } from "./client";

// The browser calls the same-origin Next proxy (/api/agent/*), which injects the
// X-Agent-Key credential server-side and forwards to ssuAgent — so the key is never
// shipped to the client (security follow-up #11). See lib/server/agentProxy.ts.
const AGENT_PROXY_BASE = "/api/agent";

// SSE event types from ssuAgent
export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "handoff"; agent: string; message: string }
  | { type: "tool"; name: string; label?: string }
  | { type: "interrupt"; data: InterruptData }
  | { type: "error"; message: string }
  | { type: "done" };

export interface InterruptData {
  type: string;
  action_id?: number;
  details?: Record<string, unknown>;
}

/** Parse a single SSE data line to AgentEvent. Returns null if malformed. */
function parseSseData(raw: string): AgentEvent | null {
  try {
    return JSON.parse(raw) as AgentEvent;
  } catch {
    return null;
  }
}

/**
 * Normalize SSE line endings without consuming a trailing CR. A CRLF sequence
 * may be split across network chunks, so the last CR is retained until the
 * following chunk (or stream close) tells us whether it is paired with LF.
 */
function normalizeSseLineEndings(value: string, flush = false): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(flush ? /\r/g : /\r(?!$)/g, "\n");
}

/** Async generator that yields AgentEvents from a fetch SSE response body. */
export async function* readAgentStream(response: Response): AsyncGenerator<AgentEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = normalizeSseLineEndings(buffer);

      // SSE messages are separated by a blank line. Keep an incomplete frame
      // for the next chunk; a proxy is free to split a frame anywhere.
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const data = part
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data) {
          const event = parseSseData(data);
          if (event) yield event;
        }
      }
    }
    // Flush TextDecoder's trailing bytes and a final frame even if the upstream
    // closes without the optional terminating blank line.
    buffer += decoder.decode();
    buffer = normalizeSseLineEndings(buffer, true);
    const trailingData = buffer
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (trailingData) {
      const event = parseSseData(trailingData);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Carries the HTTP status so callers can react (e.g. a 403 owner mismatch). */
export class AgentStreamError extends Error {
  readonly status: number;
  constructor(endpoint: string, status: number) {
    super(`ssuAgent ${endpoint} returned ${status}`);
    this.name = "AgentStreamError";
    this.status = status;
  }
}

/** Start or continue a conversation. Returns the fetch Response for SSE reading. */
export async function startAgentStream(
  message: string,
  threadId: string,
  mcpSessionId: string | null,
  libraryConnected: boolean,
  accessToken: string | null,
): Promise<Response> {
  const response = await fetch(`${AGENT_PROXY_BASE}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      message,
      thread_id: threadId,
      mcp_session_id: mcpSessionId,
      library_connected: libraryConnected,
    }),
  });
  if (!response.ok) {
    throw new AgentStreamError("/agent/stream", response.status);
  }
  return response;
}

/** Resume a graph paused by HITL interrupt. Returns the fetch Response for SSE reading. */
export async function resumeAgentStream(
  threadId: string,
  approved: boolean,
  actionId: number | null,
  mcpSessionId: string | null,
  libraryConnected: boolean,
  accessToken: string | null,
): Promise<Response> {
  const response = await fetch(`${AGENT_PROXY_BASE}/resume`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      thread_id: threadId,
      approved,
      action_id: actionId,
      mcp_session_id: mcpSessionId,
      library_connected: libraryConnected,
    }),
  });
  if (!response.ok) {
    throw new AgentStreamError("/agent/resume", response.status);
  }
  return response;
}

export type McpProvider = "SAINT" | "LMS" | "LIBRARY";

export interface McpWebSessionResponse {
  mcpSessionId: string;
  expiresAt: string;
  /** Optional only during the backend-first rolling deployment; absence fails closed. */
  linkedProviders?: McpProvider[];
}

/** Exchange optional JWT or library cookie session for an isolated MCP provider-grant session. */
export function createMcpWebSession(accessToken: string | null) {
  return fetchJson<McpWebSessionResponse>("/api/mcp/auth/web-session", {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    credentials: "include",
  });
}
