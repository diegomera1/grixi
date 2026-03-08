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

export function useActivityTracker() {
  const bufferRef = useRef<TrackedEvent[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseRef = useRef(createClient());

  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0) return;

    const events = [...bufferRef.current];
    bufferRef.current = [];

    try {
      await supabaseRef.current.from("activity_tracking").insert(
        events.map((e) => ({
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

    // Flush on page hide
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearInterval(timerRef.current);
      flush();
    };
  }, [track, flush]);

  return { track };
}
