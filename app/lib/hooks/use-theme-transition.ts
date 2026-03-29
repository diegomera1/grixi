import { useCallback } from "react";

/**
 * Hook that wraps theme toggling with the View Transition API
 * for a smooth radial clip-path animation.
 *
 * Adapted from Grixi demo (next-themes) for React Router (cookie-based).
 * Falls back to instant switch if the API is not available.
 */
export function useThemeTransition() {
  const isDark = typeof document !== "undefined"
    ? document.documentElement.classList.contains("dark")
    : false;

  const theme = isDark ? "dark" : "light";

  const toggleTheme = useCallback(
    (e?: React.MouseEvent) => {
      const currentlyDark = document.documentElement.classList.contains("dark");
      const newTheme = currentlyDark ? "light" : "dark";

      const applyTheme = () => {
        if (newTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        // Persist via cookie (read by root loader on SSR)
        document.cookie = `grixi_theme=${newTheme}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`;
      };

      // If View Transition API not available, just switch
      if (
        typeof document === "undefined" ||
        !("startViewTransition" in document)
      ) {
        applyTheme();
        return;
      }

      // Set CSS custom properties for the click origin
      const x = e ? e.clientX : window.innerWidth / 2;
      const y = e ? e.clientY : window.innerHeight / 2;
      document.documentElement.style.setProperty("--vt-x", `${x}px`);
      document.documentElement.style.setProperty("--vt-y", `${y}px`);

      // Start view transition
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        applyTheme();
      });
    },
    []
  );

  return { theme, toggleTheme };
}
