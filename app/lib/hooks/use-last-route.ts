import { useLocation } from "react-router";
import { useEffect } from "react";

const EXCLUDED_ROUTES = ["/", "/login", "/auth", "/offline", "/suspended", "/unauthorized", "/select-org"];

/**
 * Persists the last visited route to localStorage for PWA start URL behavior.
 * When reopened in standalone mode, the app navigates to this route instead of /dashboard.
 */
export function useLastRoute() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    // Don't persist excluded routes
    if (EXCLUDED_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return;
    // Don't persist admin routes for security
    if (pathname.startsWith("/admin")) return;

    try {
      localStorage.setItem("grixi_last_route", pathname + location.search);
    } catch { /* storage full or unavailable */ }
  }, [location.pathname, location.search]);
}

/**
 * Gets the stored last route, if valid.
 */
export function getLastRoute(): string | null {
  try {
    return localStorage.getItem("grixi_last_route");
  } catch {
    return null;
  }
}
