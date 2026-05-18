"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { logoutLibrary } from "@/lib/api/library";
import { ApiError } from "@/lib/api/types";

interface LibraryAuthState {
  isConnected: boolean;
  setConnected: (v: boolean) => void;
  logout: () => Promise<void>;
}

const LibraryAuthContext = createContext<LibraryAuthState>({
  isConnected: false,
  setConnected: () => {},
  logout: async () => {},
});

export function LibraryAuthProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const setConnected = useCallback((v: boolean) => setIsConnected(v), []);
  const logout = useCallback(async () => {
    try {
      await logoutLibrary();
    } catch (error) {
      console.warn("ssuAI library logout failed", error);
    }
    setIsConnected(false);
    queryClient.removeQueries({ queryKey: ["library", "seats"] });
    queryClient.removeQueries({ queryKey: ["library", "loans"] });
  }, [queryClient]);

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      const queryKey = event.query.queryKey as unknown[];
      if (queryKey[0] !== "library") return;
      if (queryKey[1] !== "seats" && queryKey[1] !== "loans") return;

      const { status, error, data } = event.query.state;
      if (status === "success" && data) {
        setIsConnected(true);
      } else if (
        status === "error" &&
        error instanceof ApiError &&
        error.code === "LIBRARY_SESSION_REQUIRED"
      ) {
        setIsConnected(false);
      }
    });
  }, [queryClient]);

  return (
    <LibraryAuthContext.Provider value={{ isConnected, setConnected, logout }}>
      {children}
    </LibraryAuthContext.Provider>
  );
}

export function useLibraryAuth() {
  return useContext(LibraryAuthContext);
}
