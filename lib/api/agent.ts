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

      // SSE messages are separated by double newlines
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const event = parseSseData(trimmed.slice(6));
            if (event) yield event;
          }
        }
      }
    }
    // Flush remaining buffer
    if (buffer.trim().startsWith("data: ")) {
      const event = parseSseData(buffer.trim().slice(6));
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Start or continue a conversation. Returns the fetch Response for SSE reading. */
export async function startAgentStream(
  message: string,
  threadId: string,
  mcpSessionId: string | null,
): Promise<Response> {
  const response = await fetch(`${AGENT_PROXY_BASE}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, thread_id: threadId, mcp_session_id: mcpSessionId }),
  });
  if (!response.ok) {
    throw new Error(`ssuAgent /agent/stream returned ${response.status}`);
  }
  return response;
}

/** Resume a graph paused by HITL interrupt. Returns the fetch Response for SSE reading. */
export async function resumeAgentStream(
  threadId: string,
  approved: boolean,
  actionId: number | null,
  mcpSessionId: string | null,
): Promise<Response> {
  const response = await fetch(`${AGENT_PROXY_BASE}/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      thread_id: threadId,
      approved,
      action_id: actionId,
      mcp_session_id: mcpSessionId,
    }),
  });
  if (!response.ok) {
    throw new Error(`ssuAgent /agent/resume returned ${response.status}`);
  }
  return response;
}

/** Exchange JWT for mcp_session_id via ssuMCP web-session endpoint. */
export function createMcpWebSession(accessToken: string) {
  return fetchJson<{ mcpSessionId: string; expiresAt: string }>("/api/mcp/auth/web-session", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
