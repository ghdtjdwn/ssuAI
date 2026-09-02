"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { logoutLibrary } from "@/lib/api/library";
import { ApiError } from "@/lib/api/types";

const STORAGE_KEY = "library_connected";
const STORAGE_EVENT = "ssuai:library-connected";

function readStorage(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_KEY) === "true";
}

function writeStorage(v: boolean) {
  if (typeof window === "undefined") return;
  if (v) {
    sessionStorage.setItem(STORAGE_KEY, "true");
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribeStorage(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === sessionStorage && event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

interface LibraryAuthState {
  isConnected: boolean;
  credentialRevision: number;
  setConnected: (v: boolean) => void;
  markCredentialsRefreshed: () => void;
  logout: () => Promise<void>;
}

const LibraryAuthContext = createContext<LibraryAuthState>({
  isConnected: false,
  credentialRevision: 0,
  setConnected: () => {},
  markCredentialsRefreshed: () => {},
  logout: async () => {},
});

export function LibraryAuthProvider({ children }: { children: ReactNode }) {
  // useSyncExternalStore supplies the same `false` snapshot to SSR and the
  // hydration pass, then reconciles the tab-scoped sessionStorage value.
  const isConnected = useSyncExternalStore(subscribeStorage, readStorage, () => false);
  const [credentialRevision, setCredentialRevision] = useState(0);
  const queryClient = useQueryClient();

  const setConnected = useCallback((v: boolean) => {
    writeStorage(v);
  }, []);

  const markCredentialsRefreshed = useCallback(() => {
    writeStorage(true);
    setCredentialRevision((revision) => revision + 1);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutLibrary();
    } catch (error) {
      console.warn("ssuAI library logout failed", error);
    }
    writeStorage(false);
    queryClient.removeQueries({ queryKey: ["library", "seats"] });
    queryClient.removeQueries({ queryKey: ["library", "loans"] });
  }, [queryClient]);

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      const queryKey = event.query.queryKey as unknown[];
      // Only the loans endpoint requires a library session, so it is the sole
      // signal for connected state. Seat availability is public: its success
      // says nothing about whether this visitor is authenticated, so it must
      // never set or refresh the connected flag.
      if (queryKey[0] !== "library" || queryKey[1] !== "loans") return;

      const { status, error, data } = event.query.state;
      if (status === "success" && data) {
        setConnected(true);
      } else if (status === "error" && error instanceof ApiError) {
        const sessionLost =
          error.code === "LIBRARY_SESSION_REQUIRED" ||
          error.httpStatus === 401 ||
          error.httpStatus === 403;
        if (sessionLost) {
          setConnected(false);
        }
      }
    });
  }, [queryClient, setConnected]);

  return (
    <LibraryAuthContext.Provider
      value={{
        isConnected,
        credentialRevision,
        setConnected,
        markCredentialsRefreshed,
        logout,
      }}
    >
      {children}
    </LibraryAuthContext.Provider>
  );
}

export function useLibraryAuth() {
  return useContext(LibraryAuthContext);
}
