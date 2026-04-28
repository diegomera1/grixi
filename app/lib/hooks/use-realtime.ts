import { useEffect, useRef, useCallback } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

// Supabase client for browser — uses anon key (RLS enforced)
let browserClient: ReturnType<typeof createClient> | null = null;

function getBrowserClient() {
  if (browserClient) return browserClient;

  // These are public — safe to expose in browser
  const url = (window as any).__SUPABASE_URL__ || "";
  const key = (window as any).__SUPABASE_ANON_KEY__ || "";

  if (!url || !key) return null;

  browserClient = createClient(url, key, {
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  });

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
 * Automatically subscribes/unsubscribes on mount/unmount.
 */
export function useRealtimeSubscription(options: UseRealtimeOptions) {
  const { table, schema = "public", event = "*", filter, enabled = true, onInsert, onUpdate, onDelete, onChange } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const client = getBrowserClient();
    if (!client) return;

    const channelName = `realtime:${table}:${filter || "all"}`;

    const channelConfig: any = {
      event,
      schema,
      table,
    };
    if (filter) channelConfig.filter = filter;

    const channel = client
      .channel(channelName)
      .on("postgres_changes", channelConfig, (payload: any) => {
        onChange?.(payload);

        switch (payload.eventType) {
          case "INSERT":
            onInsert?.(payload);
            break;
          case "UPDATE":
            onUpdate?.(payload);
            break;
          case "DELETE":
            onDelete?.(payload);
            break;
        }
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] ✓ Subscribed to ${table}`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, schema, event, filter, enabled]);
}

/**
 * Initialize the browser Supabase client with env variables passed from server.
 * Call this once in the root layout — SYNCHRONOUSLY before hooks.
 */
export function initRealtimeClient(url: string, anonKey: string) {
  (window as any).__SUPABASE_URL__ = url;
  (window as any).__SUPABASE_ANON_KEY__ = anonKey;
  // Eagerly create client so hooks can use it immediately
  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
}
