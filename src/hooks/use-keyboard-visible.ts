"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "./use-is-mobile";

/**
 * Detects if the on-screen keyboard is open on mobile.
 * Uses visualViewport API — if viewport height drops below 75% of window height,
 * the keyboard is likely open. This threshold avoids false positives from orientation changes.
 */
export function useKeyboardVisible(): boolean {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobile || typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;
    const handler = () => {
      setVisible(vv.height < window.innerHeight * 0.75);
    };

    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, [isMobile]);

  return visible;
}
