"use client";

import { useEffect } from "react";

/**
 * Fixes two iOS PWA viewport issues:
 * 
 * 1. VIEWPORT HEIGHT: Freezes window.innerHeight as --app-height CSS variable.
 *    CSS units (100vh, 100dvh, h-full) are all unreliable on iOS.
 * 
 * 2. SAFE AREA BOTTOM: Detects the bottom safe area inset and sets --safe-bottom.
 *    On iOS standalone PWA, env(safe-area-inset-bottom) can silently fail.
 *    We detect it via JS and provide a 34px fallback for modern iPhones.
 *    All iPhones since X (2017) use 34px for the home indicator area.
 */
export function ViewportHeightFix() {
  useEffect(() => {
    const doc = document.documentElement;

    // 1. Set viewport height from actual pixels
    function setAppHeight() {
      doc.style.setProperty("--app-height", `${window.innerHeight}px`);
    }
    setAppHeight();

    // Only update on orientation change (not resize — iOS fires resize for keyboard/urlbar)
    const mql = window.matchMedia("(orientation: portrait)");
    mql.addEventListener("change", setAppHeight);

    // 2. Detect safe area bottom
    // Try reading the env() value via a hidden element
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;bottom:0;left:0;width:1px;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;";
    document.body.appendChild(probe);

    // Read the computed padding
    const computedSafe = parseInt(getComputedStyle(probe).paddingBottom, 10) || 0;
    document.body.removeChild(probe);

    // Detect iOS standalone PWA mode
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
      || window.matchMedia("(display-mode: standalone)").matches;

    // Use computed value, or fallback to 34px for iOS standalone (all modern iPhones)
    let safeBottom = computedSafe;
    if (safeBottom === 0 && isIOS && isStandalone) {
      safeBottom = 34; // Home indicator height on all modern iPhones
    }

    doc.style.setProperty("--safe-bottom", `${safeBottom}px`);

    return () => mql.removeEventListener("change", setAppHeight);
  }, []);

  return null;
}
