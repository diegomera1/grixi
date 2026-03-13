"use client";

import { useEffect } from "react";

/**
 * Freezes the viewport height using window.innerHeight.
 * 
 * On iOS Safari/PWA, CSS units like 100vh, 100dvh, 100% are all unreliable
 * because iOS dynamically resizes the viewport during navigation, scroll,
 * and keyboard events.
 * 
 * This component:
 * 1. Reads window.innerHeight (the ACTUAL visible pixels)
 * 2. Sets it as --app-height CSS variable on <html>
 * 3. Does NOT listen for resize — the height is frozen on mount
 * 4. Only updates on orientation change (actual screen rotation)
 * 
 * Usage in CSS: height: var(--app-height, 100vh)
 */
export function ViewportHeightFix() {
  useEffect(() => {
    function setAppHeight() {
      const vh = window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${vh}px`);
    }

    // Set immediately
    setAppHeight();

    // Only update on orientation change, not on regular resize
    // (regular resize on iOS = address bar show/hide = bad)
    const mql = window.matchMedia("(orientation: portrait)");
    mql.addEventListener("change", setAppHeight);

    return () => mql.removeEventListener("change", setAppHeight);
  }, []);

  return null;
}
