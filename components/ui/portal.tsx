"use client";

import { createPortal } from "react-dom";
import { type ReactNode, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Render viewport-level UI outside transformed or filtered app-shell ancestors. */
export function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  return mounted ? createPortal(children, document.body) : null;
}
