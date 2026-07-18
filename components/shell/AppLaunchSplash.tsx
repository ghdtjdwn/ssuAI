"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useSaintAuth } from "@/hooks/useSaintAuth";

type SplashPhase = "visible" | "leaving" | "hidden";

const MIN_VISIBLE_MS = 1_200;
const MAX_VISIBLE_MS = 3_200;
const EXIT_DURATION_MS = 420;
const MOBILE_VIEWPORT_QUERY = "(max-width: 1023px)";
const APP_REGION_SELECTOR = "[data-app-shell-region]";

function subscribeToInitialViewport() {
  return () => undefined;
}

function getMobileViewportSnapshot() {
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

function getServerViewportSnapshot() {
  return false;
}

/**
 * Mobile-only launch cover for the app's first auth hydration.
 *
 * The phase is intentionally one-way: later background token refreshes must
 * never cover the app again. A maximum timer also prevents a slow auth request
 * or image failure from trapping the user behind the splash.
 */
export function AppLaunchSplash() {
  const { isLoading } = useSaintAuth();
  const isMobileViewport = useSyncExternalStore(
    subscribeToInitialViewport,
    getMobileViewportSnapshot,
    getServerViewportSnapshot,
  );
  const [imageSettled, setImageSettled] = useState(false);
  const [phase, setPhase] = useState<SplashPhase>("visible");
  const mountedAt = useRef<number | null>(null);

  const beginExit = useCallback(() => {
    setPhase((current) => (current === "visible" ? "leaving" : current));
  }, []);

  useEffect(() => {
    if (phase !== "visible") return;

    if (mountedAt.current === null) {
      mountedAt.current = Date.now();
    }

    const elapsed = Date.now() - mountedAt.current;
    const timeout = window.setTimeout(beginExit, Math.max(0, MAX_VISIBLE_MS - elapsed));
    return () => window.clearTimeout(timeout);
  }, [beginExit, phase]);

  useEffect(() => {
    if (!isMobileViewport || phase !== "visible") return;

    const appRegions = document.querySelectorAll<HTMLElement>(APP_REGION_SELECTOR);
    appRegions.forEach((region) => {
      region.setAttribute("inert", "");
      region.setAttribute("aria-busy", "true");
    });

    return () => {
      appRegions.forEach((region) => {
        region.removeAttribute("inert");
        region.removeAttribute("aria-busy");
      });
    };
  }, [isMobileViewport, phase]);

  useEffect(() => {
    if (phase !== "visible" || isLoading || !imageSettled || mountedAt.current === null) {
      return;
    }

    const elapsed = Date.now() - mountedAt.current;
    const timeout = window.setTimeout(beginExit, Math.max(0, MIN_VISIBLE_MS - elapsed));
    return () => window.clearTimeout(timeout);
  }, [beginExit, imageSettled, isLoading, phase]);

  useEffect(() => {
    if (phase !== "leaving") return;

    const timeout = window.setTimeout(() => setPhase("hidden"), EXIT_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-phase={phase}
      data-testid="app-launch-splash"
      className="launch-splash fixed inset-0 z-[100] min-h-dvh overflow-hidden bg-[#fbfcff] lg:hidden"
    >
      <div className="absolute inset-0" aria-hidden="true">
        {isMobileViewport ? (
          <>
            <Image
              src="/images/ssuai-loading-splash-v2.png"
              alt=""
              fill
              loading="eager"
              fetchPriority="high"
              sizes="100vw"
              className="launch-splash-image object-cover"
              data-testid="app-launch-splash-image"
              onLoad={() => setImageSettled(true)}
              onError={() => setImageSettled(true)}
            />
            <span className="launch-splash-glow" />
          </>
        ) : null}
      </div>
      <span className="sr-only">ssuAI를 준비하고 있어요.</span>
    </div>
  );
}
