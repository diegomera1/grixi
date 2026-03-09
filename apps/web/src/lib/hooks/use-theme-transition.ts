"use client";

import { useTheme } from "next-themes";
import { useCallback } from "react";

/**
 * Hook that wraps theme toggling with the View Transition API
 * for a smooth radial clip-path animation.
 *
 * Falls back to instant switch if the API is not available.
 */
export function useThemeTransition() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = useCallback(
    (e?: React.MouseEvent) => {
      const newTheme = theme === "dark" ? "light" : "dark";

      // If View Transition API not available, just switch
      if (
        typeof document === "undefined" ||
        !("startViewTransition" in document)
      ) {
        setTheme(newTheme);
        return;
      }

      // Set CSS custom properties for the click origin
      const x = e ? e.clientX : window.innerWidth / 2;
      const y = e ? e.clientY : window.innerHeight / 2;
      document.documentElement.style.setProperty("--vt-x", `${x}px`);
      document.documentElement.style.setProperty("--vt-y", `${y}px`);

      // Start view transition
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        setTheme(newTheme);
      });
    },
    [theme, setTheme]
  );

  return { theme, toggleTheme };
}
