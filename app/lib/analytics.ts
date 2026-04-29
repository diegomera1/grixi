/**
 * Analytics — Client-side tracking
 * 
 * Lightweight, privacy-respecting product analytics.
 * Batches events and sends every 5s or on page unload.
 * 
 * Usage:
 *   import { track, trackPageView } from "~/lib/analytics";
 *   track("feature_used", { module: "finanzas", action: "export_csv" });
 *   trackPageView();
 */

let sessionId: string | null = null;
let context: { userId?: string; organizationId?: string } = {};
let eventQueue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

interface AnalyticsEvent {
  eventName: string;
  category: string;
  userId?: string;
  organizationId?: string;
  properties: Record<string, any>;
  sessionId: string;
  url: string;
  route: string;
  referrer: string;
  userAgent: string;
}

function getSessionId(): string {
  if (sessionId) return sessionId;
  // Persist per browser session (cleared on close)
  sessionId = sessionStorage.getItem("grixi_session_id");
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("grixi_session_id", sessionId);
  }
  return sessionId;
}

/**
 * Track a custom event
 */
export function track(
  eventName: string,
  properties: Record<string, any> = {},
  category = "general"
) {
  if (typeof window === "undefined") return;
  // Skip in dev
  if (window.location.hostname === "localhost") return;

  const event: AnalyticsEvent = {
    eventName,
    category,
    userId: context.userId,
    organizationId: context.organizationId,
    properties,
    sessionId: getSessionId(),
    url: window.location.href,
    route: window.location.pathname,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
  };

  eventQueue.push(event);

  // Auto-flush after 5 seconds of buffering
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 5000);
  }

  // Flush immediately if queue is large
  if (eventQueue.length >= 10) {
    flush();
  }
}

/**
 * Track a page view (call on route change)
 */
export function trackPageView(ctx?: {
  userId?: string;
  organizationId?: string;
}) {
  if (ctx) context = ctx;

  if (!initialized) {
    initialized = true;
    // Flush on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush();
      });
    }
  }

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const module = path.split("/")[1] || "root";

  track("page_view", { path, module }, "navigation");
}

/**
 * Track feature usage
 */
export function trackFeature(feature: string, action: string, extra?: Record<string, any>) {
  track("feature_used", { feature, action, ...extra }, "feature");
}

/**
 * Track user action (button click, form submit, etc.)
 */
export function trackAction(action: string, extra?: Record<string, any>) {
  track("action_completed", { action, ...extra }, "action");
}

/**
 * Flush queued events to the server
 */
function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue = [];

  // Use sendBeacon for reliability (works on page close)
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(events)], {
      type: "application/json",
    });
    navigator.sendBeacon("/api/analytics", blob);
  } else {
    fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GRIXI-Client": "1",
      },
      body: JSON.stringify(events),
      keepalive: true,
    }).catch(() => {});
  }
}
