import { useState, useEffect, useCallback } from "react";

/**
 * Hook that wraps theme toggling with the View Transition API
 * for a smooth radial clip-path animation.
 *
 * Uses reactive state so toggling the theme doesn't cause
 * parent components (like the Orb menu) to lose their state.
 */
export function useThemeTransition() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  // Sync if the class changes externally (e.g. SSR hydration mismatch)
  useEffect(() => {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    if (current !== theme) setTheme(current);
  }, []);

  const toggleTheme = useCallback(
    (e?: React.MouseEvent) => {
      const newTheme = theme === "dark" ? "light" : "dark";

      const applyTheme = () => {
        if (newTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        // Persist via cookie (read by root loader on SSR)
        document.cookie = `grixi_theme=${newTheme}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`;
        // Update reactive state AFTER DOM mutation
        setTheme(newTheme);
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
    [theme]
  );

  return { theme, toggleTheme };
}
