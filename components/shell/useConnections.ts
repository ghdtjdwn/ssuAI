"use client";

import { useMcpSession } from "@/contexts/McpSessionContext";

export interface ConnectionsState {
  saint: boolean;
  lms: boolean;
  library: boolean;
  count: number;
}

/**
 * Server-confirmed u-SAINT · LMS · library grants for the shell badge.
 * A JWT or a prior successful query is not proof that the provider credential
 * still exists, so only web-session.linkedProviders is authoritative.
 */
export function useConnections(): ConnectionsState {
  const { session } = useMcpSession();
  const providers = new Set(session?.linkedProviders ?? []);
  const saint = providers.has("SAINT");
  const lms = providers.has("LMS");
  const library = providers.has("LIBRARY");
  const count = Number(saint) + Number(lms) + Number(library);
  return { saint, lms, library, count };
}
