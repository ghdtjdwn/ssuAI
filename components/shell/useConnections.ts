"use client";

import { useMcpSession } from "@/contexts/McpSessionContext";
import {
  getProviderConnectionState,
  type ProviderConnectionState,
} from "@/lib/mcpConnections";

export interface ConnectionsState {
  saint: ProviderConnectionState;
  lms: ProviderConnectionState;
  library: ProviderConnectionState;
  count: number;
  lastKnownCount: number;
  status: "idle" | "checking" | "verified" | "stale" | "error";
}

/**
 * Server-confirmed u-SAINT · LMS · library availability for the shell badge.
 * A JWT or a prior successful query is not proof that the provider credential
 * is usable, so web-session.availableProviders is preferred with a backward-
 * compatible linkedProviders/providerHealth fallback during rollout.
 */
export function useConnections(): ConnectionsState {
  const { session, status: sessionStatus } = useMcpSession();
  const freshStates = {
    saint: getProviderConnectionState(session, "SAINT"),
    lms: getProviderConnectionState(session, "LMS"),
    library: getProviderConnectionState(session, "LIBRARY"),
  };
  const stateMode = sessionStatus === "stale" ? "stale" : "fresh";
  const saint = getProviderConnectionState(session, "SAINT", stateMode);
  const lms = getProviderConnectionState(session, "LMS", stateMode);
  const library = getProviderConnectionState(session, "LIBRARY", stateMode);
  const states = [saint, lms, library];
  const isUsable = (state: ProviderConnectionState) =>
    state === "connected" || state === "unverified";
  const count = states.filter(isUsable).length;
  const lastKnownCount = Object.values(freshStates).filter(isUsable).length;
  const status =
    sessionStatus === "connecting"
      ? "checking"
      : sessionStatus === "connected"
        ? "verified"
        : sessionStatus;

  return { saint, lms, library, count, lastKnownCount, status };
}
