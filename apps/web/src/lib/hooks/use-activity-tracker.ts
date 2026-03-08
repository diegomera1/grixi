"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type TrackedEvent = {
  event_type: "page_view" | "click" | "form_submit" | "scroll" | "focus";
  page_path: string;
  element_id: string | null;
  element_text: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 5000; // 5 seconds
const LAST_ACTIVE_INTERVAL = 60000; // 1 minute

export function useActivityTracker() {
  const bufferRef = useRef<TrackedEvent[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseRef = useRef(createClient());
  const userIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Fetch user on mount
  useEffect(() => {
    const supabase = supabaseRef.current;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        userIdRef.current = data.user.id;
        // Create or update active session
        createSession(data.user.id);
        // Start last_active_at heartbeat
        updateLastActive(data.user.id);
        activeTimerRef.current = setInterval(() => {
          updateLastActive(data.user.id);
          heartbeatSession();
        }, LAST_ACTIVE_INTERVAL);
      }
    });

    return () => {
      if (activeTimerRef.current) clearInterval(activeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createSession = async (userId: string) => {
    const supabase = supabaseRef.current;
    const deviceInfo = {
      browser: getBrowserName(),
      os: getOSName(),
      device: /Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
      screenWidth: window.screen.width.toString(),
      screenHeight: window.screen.height.toString(),
    };

    const { data } = await supabase
      .from("active_sessions")
      .insert({
        user_id: userId,
        org_id: "a0000000-0000-0000-0000-000000000001",
        device_info: deviceInfo,
        is_active: true,
        started_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (data) sessionIdRef.current = data.id;
  };

  const heartbeatSession = async () => {
    if (!sessionIdRef.current) return;
    await supabaseRef.current
      .from("active_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", sessionIdRef.current);
  };

  const updateLastActive = async (userId: string) => {
    await supabaseRef.current
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", userId);
  };

  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0) return;

    const events = [...bufferRef.current];
    bufferRef.current = [];

    try {
      await supabaseRef.current.from("activity_tracking").insert(
        events.map((e) => ({
          user_id: userIdRef.current,
          session_id: sessionIdRef.current,
          event_type: e.event_type,
          page_path: e.page_path,
          element_id: e.element_id,
          element_text: e.element_text,
          metadata: e.metadata,
          created_at: e.created_at,
        }))
      );
    } catch {
      // Re-add failed events to buffer for retry
      bufferRef.current.unshift(...events);
    }
  }, []);

  const track = useCallback(
    (event: Omit<TrackedEvent, "created_at">) => {
      bufferRef.current.push({
        ...event,
        created_at: new Date().toISOString(),
      });

      if (bufferRef.current.length >= BATCH_SIZE) {
        flush();
      }
    },
    [flush]
  );

  useEffect(() => {
    const pagePath = window.location.pathname;

    // Track initial page view
    track({
      event_type: "page_view",
      page_path: pagePath,
      element_id: null,
      element_text: null,
      metadata: { referrer: document.referrer, userAgent: navigator.userAgent },
    });

    // Global click listener
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const closest =
        target.closest("button") ||
        target.closest("a") ||
        target.closest("[data-track]") ||
        target;

      track({
        event_type: "click",
        page_path: pagePath,
        element_id: closest.id || closest.getAttribute("data-track") || null,
        element_text: closest.textContent?.slice(0, 50) || null,
        metadata: {
          tagName: closest.tagName,
          x: e.clientX,
          y: e.clientY,
          className: closest.className?.toString().slice(0, 100) || "",
        },
      });
    };

    document.addEventListener("click", handleClick, { capture: true });

    // Flush timer
    timerRef.current = setInterval(flush, FLUSH_INTERVAL);

    // Flush on page hide + terminate session
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Terminate session on unload
    const handleBeforeUnload = () => {
      flush();
      if (sessionIdRef.current) {
        // Use sendBeacon for reliable unload tracking
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          navigator.sendBeacon(
            `${supabaseUrl}/rest/v1/active_sessions?id=eq.${sessionIdRef.current}`,
            JSON.stringify({
              is_active: false,
              terminated_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
            })
          );
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearInterval(timerRef.current);
      flush();
    };
  }, [track, flush]);

  return { track };
}

// ─── Helpers ──────────────────────────────────────────────

function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Other";
}

function getOSName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Win")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Other";
}
