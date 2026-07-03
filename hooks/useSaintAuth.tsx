"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { clearAgentThread } from "@/lib/agentThread";
import { callLogout, fetchMe, refreshAccessToken, type AuthMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/types";

export interface SaintAuthState {
  user: AuthMe | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Force a refresh-cookie → access-JWT → /me cycle. Returns true on success. */
  refresh: () => Promise<boolean>;
  /**
   * Best-effort logout: POST /api/auth/logout to clear the refresh cookie,
   * then wipe in-memory state. Cookie-clear errors are swallowed because
   * the in-memory state still gets reset so the UI flips to anonymous.
   */
  logout: () => Promise<void>;
}

const SaintAuthContext = createContext<SaintAuthState | null>(null);

export function SaintAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthMe | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasHydrated = useRef(false);
  // Stores the access token TTL returned by the backend so the auto-refresh
  // timer can fire ~2 min before actual expiry instead of using a hardcoded value.
  const accessTtlRef = useRef<number>(900);

  const refresh = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { accessToken: newAccess, accessTtlSeconds } = await refreshAccessToken();
      const me = await fetchMe(newAccess);
      accessTtlRef.current = accessTtlSeconds;
      setAccessToken(newAccess);
      setUser(me);
      return true;
    } catch (error) {
      // 401 = anonymous visitor with no refresh cookie. Silent.
      if (!(error instanceof ApiError && error.httpStatus === 401)) {
        console.warn("ssuAI auth refresh failed", error);
      }
      setAccessToken(null);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await callLogout();
    } catch (error) {
      console.warn("ssuAI logout cookie clear failed", error);
    }
    setAccessToken(null);
    setUser(null);
    // Drop cached private data so a different account on the same browser
    // never sees the previous user's grades/assignments/loans.
    queryClient.removeQueries({ queryKey: ["saint"] });
    queryClient.removeQueries({ queryKey: ["lms"] });
    queryClient.removeQueries({ queryKey: ["library"] });
    // Drop the ssuAgent conversation thread id: the agent binds a thread to
    // the mcp_session_id that first used it, and that session rotates on
    // re-login — a surviving thread id would 403 the same user after they
    // reconnect. Must live here (not only in the chat panel) so logging out
    // from any tab clears it even when the chat UI is unmounted.
    clearAgentThread();
  }, [queryClient]);

  // Try to hydrate on first mount. If the user has a valid refresh cookie
  // from a previous SSO flow, they will appear logged in without clicking
  // the SSO button again.
  useEffect(() => {
    if (hasHydrated.current) {
      return;
    }
    hasHydrated.current = true;
    void refresh();
  }, [refresh]);

  // Proactively refresh the access token 2 min before it expires so the
  // user is never silently logged out mid-session. The timer resets each
  // time a new access token is issued (accessToken state change).
  useEffect(() => {
    if (!accessToken) return;
    const delay = Math.max(0, (accessTtlRef.current - 120) * 1000);
    const timer = setTimeout(() => void refresh(), delay);
    return () => clearTimeout(timer);
  }, [accessToken, refresh]);

  const value: SaintAuthState = {
    user,
    accessToken,
    isLoading,
    isAuthenticated: !!accessToken && !!user,
    refresh,
    logout,
  };

  return <SaintAuthContext.Provider value={value}>{children}</SaintAuthContext.Provider>;
}

export function useSaintAuth(): SaintAuthState {
  const ctx = useContext(SaintAuthContext);
  if (!ctx) {
    throw new Error("useSaintAuth must be used within <SaintAuthProvider>");
  }
  return ctx;
}
