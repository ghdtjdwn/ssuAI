/**
 * The LangGraph conversation thread id the chat UI sends to ssuAgent.
 *
 * ssuAgent binds each thread to the mcp_session_id that first used it and
 * returns 403 on an owner mismatch. The mcp session rotates on every SSO
 * re-login, so a thread id that survives logout would lock the *same user*
 * out of their own conversation after they reconnect. The id therefore
 * lives in sessionStorage and MUST be cleared whenever the u-SAINT session
 * ends — `useSaintAuth.logout()` calls {@link clearAgentThread} so the
 * clear happens even when the chat tab is not mounted.
 */
export const AGENT_THREAD_ID_KEY = "ssuagent_thread_id";

function newThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateAgentThreadId(): string {
  if (typeof window === "undefined") return newThreadId();
  const stored = sessionStorage.getItem(AGENT_THREAD_ID_KEY);
  if (stored) return stored;
  const fresh = newThreadId();
  sessionStorage.setItem(AGENT_THREAD_ID_KEY, fresh);
  return fresh;
}

export function clearAgentThread(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AGENT_THREAD_ID_KEY);
}
