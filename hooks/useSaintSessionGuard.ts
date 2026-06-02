import { useEffect } from "react";

import { useSaintAuth } from "./useSaintAuth";

/**
 * Detects SAINT_SESSION_EXPIRED errors and auto-logs out so the header
 * shows the login button instead of leaving per-card "re-login" UI.
 */
export function useSaintSessionGuard(errorCode: string | undefined) {
  const { logout } = useSaintAuth();

  useEffect(() => {
    if (errorCode === "SAINT_SESSION_EXPIRED") {
      void logout();
    }
  }, [errorCode, logout]);
}
