import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════
// Supabase Realtime — Browser client via @supabase/ssr
// Uses cookie-based auth automatically (same as server client)
// ═══════════════════════════════════════════════════════════

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserClient() {
  return browserClient;
}

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimeOptions {
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  filter?: string;
  enabled?: boolean;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onChange?: (payload: any) => void;
}

/**
 * Hook for Supabase Realtime subscriptions.
 * Uses @supabase/ssr browser client with cookie-based auth for RLS.
 */
export function useRealtimeSubscription(options: UseRealtimeOptions) {
  const { table, schema = "public", event = "*", filter, enabled = true, onInsert, onUpdate, onDelete, onChange } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Store callbacks in refs to avoid re-subscribing on every render
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete, onChange });
  callbacksRef.current = { onInsert, onUpdate, onDelete, onChange };

  useEffect(() => {
    if (!enabled || !browserClient) return;

    const channelName = `realtime:${table}:${filter || "all"}`;

    const channelConfig: any = { event, schema, table };
    if (filter) channelConfig.filter = filter;

    const channel = browserClient
      .channel(channelName)
      .on("postgres_changes", channelConfig, (payload: any) => {
        callbacksRef.current.onChange?.(payload);

        switch (payload.eventType) {
          case "INSERT":
            callbacksRef.current.onInsert?.(payload);
            break;
          case "UPDATE":
            callbacksRef.current.onUpdate?.(payload);
            break;
          case "DELETE":
            callbacksRef.current.onDelete?.(payload);
            break;
        }
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] ✓ Subscribed to ${table}`);
        } else {
          console.warn(`[Realtime] ${status} for ${table}`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && browserClient) {
        browserClient.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, schema, event, filter, enabled]);
}

/**
 * Initialize the browser Supabase client using @supabase/ssr.
 * This reads auth from cookies automatically — no manual setSession needed.
 */
export function initRealtimeClient(url: string, anonKey: string) {
  if (typeof window === "undefined") return;
  if (browserClient) return; // Already initialized

  browserClient = createBrowserClient(url, anonKey);
  console.log("[Realtime] ✓ Browser client initialized via @supabase/ssr");
}
