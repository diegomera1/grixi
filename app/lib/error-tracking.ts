/**
 * Error Tracking — Client-side
 * 
 * Captures unhandled errors and promise rejections,
 * sends them to /api/errors for logging.
 * 
 * Usage in root.tsx or authenticated.tsx:
 *   import { initErrorTracking } from "~/lib/error-tracking";
 *   useEffect(() => initErrorTracking({ userId, orgId }), []);
 */

let initialized = false;
let context: { userId?: string; organizationId?: string } = {};

/**
 * Initialize global error tracking handlers.
 * Call once in the root layout.
 */
export function initErrorTracking(ctx?: {
  userId?: string;
  organizationId?: string;
}) {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if (ctx) context = ctx;

  // Unhandled JS errors
  window.addEventListener("error", (event) => {
    reportError({
      message: event.message || "Unknown error",
      stack: event.error?.stack,
      source: "client",
      level: "error",
      url: window.location.href,
      route: window.location.pathname,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportError({
      message:
        reason?.message || String(reason) || "Unhandled Promise Rejection",
      stack: reason?.stack,
      source: "client",
      level: "error",
      url: window.location.href,
      route: window.location.pathname,
      metadata: { type: "unhandledrejection" },
    });
  });
}

/**
 * Update user/org context (call when auth state changes)
 */
export function setErrorTrackingContext(ctx: {
  userId?: string;
  organizationId?: string;
}) {
  context = ctx;
}

/**
 * Manually report an error (for caught errors in try/catch)
 */
export function reportError(error: {
  message: string;
  stack?: string;
  source?: string;
  level?: "error" | "warning" | "fatal";
  url?: string;
  route?: string;
  metadata?: Record<string, any>;
}) {
  // Don't report in dev
  if (typeof window !== "undefined" && window.location.hostname === "localhost") return;

  // Debounce: don't spam the same error
  const key = `${error.message}:${error.route}`;
  if (recentErrors.has(key)) return;
  recentErrors.add(key);
  setTimeout(() => recentErrors.delete(key), 30000); // 30s cooldown

  const payload = {
    ...error,
    userId: context.userId,
    organizationId: context.organizationId,
    userAgent: navigator.userAgent,
  };

  // Fire-and-forget (don't block UI)
  fetch("/api/errors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GRIXI-Client": "1",
    },
    body: JSON.stringify(payload),
  }).catch(() => {}); // Silently fail
}

const recentErrors = new Set<string>();
