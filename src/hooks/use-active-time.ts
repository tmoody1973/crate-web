"use client";

import { useEffect, useRef } from "react";

/**
 * Active-time hook for the Influence Receipt sprint gate metric.
 *
 * Counts seconds the page is FOREGROUND (visible). Pauses when the tab
 * is hidden (Reddit preview pipeline opens many backgrounded tabs that
 * never become visible). Fires `onQualified` once when active time
 * crosses `qualifyAfterMs`.
 *
 * Per the spec: a "qualified view" is ≥5s active on a non-bot UA.
 * Bot filtering happens at PostHog query time; this hook handles dwell.
 */
export function useActiveTime({
  qualifyAfterMs,
  onQualified,
}: {
  qualifyAfterMs: number;
  onQualified: (activeMs: number) => void;
}) {
  const firedRef = useRef(false);
  const activeMsRef = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let lastTick = document.hidden ? null : performance.now();

    function tick() {
      if (firedRef.current) return;
      if (lastTick === null) return;
      const now = performance.now();
      activeMsRef.current += now - lastTick;
      lastTick = now;
      if (activeMsRef.current >= qualifyAfterMs) {
        firedRef.current = true;
        onQualified(Math.round(activeMsRef.current));
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        tick();
        lastTick = null;
      } else {
        lastTick = performance.now();
      }
    }

    const interval = window.setInterval(tick, 1_000);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [qualifyAfterMs, onQualified]);
}
