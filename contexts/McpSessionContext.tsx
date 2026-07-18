"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLibraryAuth } from "@/contexts/LibraryAuthContext";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import {
  createMcpWebSession,
  getMcpWebSessionStatus,
  type McpProvider,
  type McpProviderHealth,
  type McpWebSessionResponse,
} from "@/lib/api/agent";
import { ApiError } from "@/lib/api/types";

const REFRESH_SKEW_MS = 30_000;
const STATUS_REFRESH_MS = 60_000;
const MAX_TIMER_MS = 2_147_000_000;
const SESSION_ERROR_MESSAGE =
  "개인 서비스 연결 세션을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
const STATUS_UNAVAILABLE_MESSAGE =
  "개인 서비스 연결 상태를 확인하지 못했습니다. 기존 세션으로 계속 시도하며 자동으로 다시 확인합니다.";

export type McpSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "stale"
  | "error";

export interface McpSession {
  mcpSessionId: string;
  expiresAt: string;
  linkedProviders: McpProvider[];
  availableProviders?: McpProvider[];
  providerHealth?: Partial<Record<McpProvider, McpProviderHealth>>;
}

interface McpSessionContextValue {
  session: McpSession | null;
  status: McpSessionStatus;
  error: string | null;
  ensureSession: () => Promise<McpSession | null>;
  refreshSession: () => Promise<McpSession | null>;
}

interface WebIdentity {
  key: string;
  accessToken: string | null;
  available: boolean;
}

const McpSessionContext = createContext<McpSessionContextValue | null>(null);

function isFresh(session: McpSession) {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt - Date.now() > REFRESH_SKEW_MS;
}

function normalizeSession(response: McpWebSessionResponse): McpSession {
  const expiresAt = Date.parse(response.expiresAt);
  if (!response.mcpSessionId?.trim() || !Number.isFinite(expiresAt)) {
    throw new Error(SESSION_ERROR_MESSAGE);
  }
  const allowed = new Set<McpProvider>(["SAINT", "LMS", "LIBRARY"]);
  const linkedProviders = Array.from(
    new Set((response.linkedProviders ?? []).filter((provider) => allowed.has(provider))),
  );
  const availableProviders = response.availableProviders
    ? Array.from(
        new Set(response.availableProviders.filter((provider) => allowed.has(provider))),
      )
    : undefined;
  return {
    mcpSessionId: response.mcpSessionId,
    expiresAt: response.expiresAt,
    linkedProviders,
    availableProviders,
    providerHealth: response.providerHealth,
  };
}

function isRetryableStatusFailure(cause: unknown) {
  if (!(cause instanceof ApiError)) {
    return true;
  }
  return cause.httpStatus >= 500 || [408, 425, 429].includes(cause.httpStatus);
}

export function McpSessionProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isAuthenticated, user } = useSaintAuth();
  const {
    isConnected: libraryConnected,
    credentialRevision: libraryCredentialRevision,
  } = useLibraryAuth();
  const jwtToken = isAuthenticated && accessToken ? accessToken : null;
  const saintSubject = jwtToken ? (user?.studentId ?? "authenticated") : null;
  const libraryIdentity = libraryConnected
    ? `library-${libraryCredentialRevision}`
    : "none";
  const identityKey = `${saintSubject ?? "anonymous"}:${libraryIdentity}`;
  const identityRef = useRef<WebIdentity>({
    key: identityKey,
    accessToken: jwtToken,
    available: Boolean(jwtToken || libraryConnected),
  });

  const cachedRef = useRef<{ key: string; session: McpSession } | null>(null);
  const inFlightRef = useRef<{
    key: string;
    promise: Promise<McpSession | null>;
  } | null>(null);
  const queuedForceRef = useRef<{
    key: string;
    after: Promise<McpSession | null>;
    token: object;
    promise: Promise<McpSession | null>;
  } | null>(null);
  const [session, setSession] = useState<McpSession | null>(null);
  const [status, setStatus] = useState<McpSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const acquireSession = useCallback(async (forceStatus = false): Promise<McpSession | null> => {
    const acquireCurrent = async (): Promise<McpSession | null> => {
      const identity = identityRef.current;
      if (!identity.available) {
        return null;
      }

      const cached = cachedRef.current;
      if (cached?.key === identity.key && isFresh(cached.session) && !forceStatus) {
        return cached.session;
      }
      if (inFlightRef.current?.key === identity.key) {
        const inFlight = inFlightRef.current.promise;
        if (!forceStatus) {
          return inFlight;
        }

        const queuedForce = queuedForceRef.current;
        if (queuedForce?.key === identity.key && queuedForce.after === inFlight) {
          return queuedForce.promise;
        }

        const queuedIdentityKey = identity.key;
        const queueToken = {};
        const queuedPromise = inFlight
          .catch(() => null)
          .then(() => {
            if (queuedForceRef.current?.token === queueToken) {
              queuedForceRef.current = null;
            }
            if (
              identityRef.current.key !== queuedIdentityKey ||
              !identityRef.current.available
            ) {
              return null;
            }
            return acquireCurrent();
          })
          .finally(() => {
            if (queuedForceRef.current?.token === queueToken) {
              queuedForceRef.current = null;
            }
          });
        queuedForceRef.current = {
          key: queuedIdentityKey,
          after: inFlight,
          token: queueToken,
          promise: queuedPromise,
        };
        return queuedPromise;
      }

      if (!cached || cached.key !== identity.key) {
        setStatus("connecting");
      }
      setError(null);
      const hasRefreshableSession =
        cached?.key === identity.key && isFresh(cached.session);
      const responsePromise: Promise<{
        response: McpWebSessionResponse;
        verified: boolean;
      }> = hasRefreshableSession
        ? getMcpWebSessionStatus(cached.session.mcpSessionId, identity.accessToken)
            .then((response) => ({ response, verified: true }))
            .catch((cause: unknown) => {
              if (identityRef.current.key !== identity.key) {
                throw cause;
              }
              if (cause instanceof ApiError && [401, 404].includes(cause.httpStatus)) {
                return createMcpWebSession(identityRef.current.accessToken).then((response) => ({
                  response,
                  verified: true,
                }));
              }
              if (isRetryableStatusFailure(cause)) {
                return { response: cached.session, verified: false };
              }
              throw cause;
            })
        : createMcpWebSession(identity.accessToken).then((response) => ({
            response,
            verified: true,
          }));
      const request: Promise<McpSession | null> = responsePromise
        .then(({ response, verified }) => {
          if (response === null) {
            return null;
          }
          if (identityRef.current.key !== identity.key) {
            return acquireCurrent();
          }
          const normalized = normalizeSession(response);
          cachedRef.current = { key: identity.key, session: normalized };
          setSession(normalized);
          setStatus(verified ? "connected" : "stale");
          setError(verified ? null : STATUS_UNAVAILABLE_MESSAGE);
          return normalized;
        })
        .catch((cause: unknown) => {
          if (identityRef.current.key !== identity.key) {
            return acquireCurrent();
          }
          cachedRef.current = null;
          setSession(null);
          setStatus("error");
          setError(SESSION_ERROR_MESSAGE);
          throw cause instanceof Error && cause.message === SESSION_ERROR_MESSAGE
            ? cause
            : new Error(SESSION_ERROR_MESSAGE);
        })
        .finally(() => {
          if (inFlightRef.current?.promise === request) {
            inFlightRef.current = null;
          }
        });
      inFlightRef.current = { key: identity.key, promise: request };
      return request;
    };

    return acquireCurrent();
  }, []);

  const ensureSession = useCallback(
    () => acquireSession(false),
    [acquireSession],
  );
  const refreshSession = useCallback(
    () => acquireSession(true),
    [acquireSession],
  );

  useEffect(() => {
    const nextIdentity = {
      key: identityKey,
      accessToken: jwtToken,
      available: Boolean(jwtToken || libraryConnected),
    };
    const identityChanged = identityRef.current.key !== nextIdentity.key;
    identityRef.current = nextIdentity;
    if (!identityChanged) {
      if (nextIdentity.available && !cachedRef.current && !inFlightRef.current) {
        void ensureSession().catch(() => undefined);
      }
      return;
    }
    cachedRef.current = null;
    queuedForceRef.current = null;
    setSession(null);
    setStatus("idle");
    setError(null);
    if (identityRef.current.available) {
      void ensureSession().catch(() => undefined);
    }
  }, [identityKey, jwtToken, libraryConnected, ensureSession]);

  useEffect(() => {
    // Keep the listener mounted independently of session-scoped timers so a
    // focus event cannot be lost between a session render and its passive effect.
    const handleFocus = () => {
      if (!cachedRef.current) return;
      void refreshSession().catch(() => undefined);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshSession]);

  useEffect(() => {
    if (!session) return;
    const refreshIn = Date.parse(session.expiresAt) - Date.now() - REFRESH_SKEW_MS;
    const expiryTimer = window.setTimeout(() => {
      if (cachedRef.current?.session.mcpSessionId === session.mcpSessionId) {
        cachedRef.current = null;
      }
      void ensureSession().catch(() => undefined);
    }, Math.max(0, Math.min(refreshIn, MAX_TIMER_MS)));
    const statusTimer = window.setInterval(() => {
      void refreshSession().catch(() => undefined);
    }, STATUS_REFRESH_MS);
    return () => {
      window.clearTimeout(expiryTimer);
      window.clearInterval(statusTimer);
    };
  }, [session, ensureSession, refreshSession]);

  const value = useMemo(
    () => ({ session, status, error, ensureSession, refreshSession }),
    [session, status, error, ensureSession, refreshSession],
  );

  return <McpSessionContext.Provider value={value}>{children}</McpSessionContext.Provider>;
}

export function useMcpSession() {
  const value = useContext(McpSessionContext);
  if (!value) {
    throw new Error("useMcpSession must be used within McpSessionProvider");
  }
  return value;
}
