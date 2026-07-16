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
  type McpProvider,
  type McpWebSessionResponse,
} from "@/lib/api/agent";

const REFRESH_SKEW_MS = 30_000;
const MAX_TIMER_MS = 2_147_000_000;
const SESSION_ERROR_MESSAGE =
  "개인 서비스 연결 세션을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";

export type McpSessionStatus = "idle" | "connecting" | "connected" | "error";

export interface McpSession {
  mcpSessionId: string;
  expiresAt: string;
  linkedProviders: McpProvider[];
}

interface McpSessionContextValue {
  session: McpSession | null;
  status: McpSessionStatus;
  error: string | null;
  ensureSession: () => Promise<McpSession | null>;
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
  return {
    mcpSessionId: response.mcpSessionId,
    expiresAt: response.expiresAt,
    linkedProviders,
  };
}

export function McpSessionProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isAuthenticated } = useSaintAuth();
  const { isConnected: libraryConnected } = useLibraryAuth();
  const jwtToken = isAuthenticated && accessToken ? accessToken : null;
  const identityKey = `${jwtToken ?? "anonymous"}:${libraryConnected ? "library" : "none"}`;
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
  const [session, setSession] = useState<McpSession | null>(null);
  const [status, setStatus] = useState<McpSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const ensureSession = useCallback(async (): Promise<McpSession | null> => {
    const acquireCurrent = async (): Promise<McpSession | null> => {
      const identity = identityRef.current;
      if (!identity.available) {
        return null;
      }

      const cached = cachedRef.current;
      if (cached?.key === identity.key && isFresh(cached.session)) {
        return cached.session;
      }
      if (inFlightRef.current?.key === identity.key) {
        return inFlightRef.current.promise;
      }

      setStatus("connecting");
      setError(null);
      const request: Promise<McpSession | null> = createMcpWebSession(identity.accessToken)
        .then((response) => {
          if (identityRef.current.key !== identity.key) {
            return acquireCurrent();
          }
          const normalized = normalizeSession(response);
          cachedRef.current = { key: identity.key, session: normalized };
          setSession(normalized);
          setStatus("connected");
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

  useEffect(() => {
    identityRef.current = {
      key: identityKey,
      accessToken: jwtToken,
      available: Boolean(jwtToken || libraryConnected),
    };
    cachedRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- identity changes invalidate the prior provider grants immediately.
    setSession(null);
    setStatus("idle");
    setError(null);
    if (identityRef.current.available) {
      void ensureSession().catch(() => undefined);
    }
  }, [identityKey, jwtToken, libraryConnected, ensureSession]);

  useEffect(() => {
    if (!session) return;
    const refreshIn = Date.parse(session.expiresAt) - Date.now() - REFRESH_SKEW_MS;
    const timer = window.setTimeout(() => {
      if (cachedRef.current?.session.mcpSessionId === session.mcpSessionId) {
        cachedRef.current = null;
      }
      void ensureSession().catch(() => undefined);
    }, Math.max(0, Math.min(refreshIn, MAX_TIMER_MS)));
    return () => window.clearTimeout(timer);
  }, [session, ensureSession]);

  const value = useMemo(
    () => ({ session, status, error, ensureSession }),
    [session, status, error, ensureSession],
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
