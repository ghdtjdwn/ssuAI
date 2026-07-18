import type { McpSession } from "@/contexts/McpSessionContext";
import type { McpProvider, McpProviderHealth } from "@/lib/api/agent";

export type ProviderConnectionState =
  | "connected"
  | "unverified"
  | "disconnected"
  | "expired"
  | "degraded"
  | "stale";

/**
 * Resolve one provider without treating a stored grant as healthy forever.
 * UNKNOWN is intentionally usable: freshly captured credentials can have no
 * completed health probe yet. Missing health preserves rolling compatibility.
 */
export function getProviderConnectionState(
  session: McpSession | null,
  provider: McpProvider,
  sessionStatus: "fresh" | "stale" = "fresh",
): ProviderConnectionState {
  const health: McpProviderHealth | undefined = session?.providerHealth?.[provider];
  const linked = session?.linkedProviders.includes(provider) ?? false;
  const available = session?.availableProviders !== undefined
    ? session.availableProviders.includes(provider)
    : linked;
  const hasProviderSnapshot = linked || available || health !== undefined;

  if (sessionStatus === "stale" && hasProviderSnapshot) return "stale";
  if (health === "ERROR") return "degraded";
  if (health === "EXPIRED") return "expired";
  if (!available) return "disconnected";
  if (health === "UNKNOWN") return "unverified";
  return "connected";
}

export function isProviderUsable(
  session: McpSession | null,
  provider: McpProvider,
): boolean {
  const state = getProviderConnectionState(session, provider);
  return state === "connected" || state === "unverified";
}
