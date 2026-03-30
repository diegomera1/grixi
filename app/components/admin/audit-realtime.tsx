import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface AuditEvent {
  id: string;
  action: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  old_data: any;
  new_data: any;
  metadata: any;
  ip_address: string | null;
  organization_id: string | null;
  created_at: string;
}

interface UseAuditRealtimeReturn {
  newEvents: AuditEvent[];
  isConnected: boolean;
  isPaused: boolean;
  eventCount: number;
  pause: () => void;
  resume: () => void;
  clear: () => void;
}

export function useAuditRealtime(
  supabaseUrl: string,
  supabaseAnonKey: string,
): UseAuditRealtimeReturn {
  const [newEvents, setNewEvents] = useState<AuditEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const bufferRef = useRef<AuditEvent[]>([]);
  const channelRef = useRef<any>(null);

  // Keep ref in sync with state — avoids reconnections
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;

    const client = createBrowserClient(supabaseUrl, supabaseAnonKey);

    const channel = client
      .channel("admin-audit-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        (payload: any) => {
          const event = payload.new as AuditEvent;
          bufferRef.current = [event, ...bufferRef.current].slice(0, 50);
          if (!isPausedRef.current) {
            setNewEvents((prev) => [event, ...prev].slice(0, 50));
          }
        },
      )
      .subscribe((status: string) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [supabaseUrl, supabaseAnonKey]);

  const pause = useCallback(() => setIsPaused(true), []);

  const resume = useCallback(() => {
    setIsPaused(false);
    setNewEvents(bufferRef.current);
  }, []);

  const clear = useCallback(() => {
    setNewEvents([]);
    bufferRef.current = [];
  }, []);

  return {
    newEvents,
    isConnected,
    isPaused,
    eventCount: newEvents.length,
    pause,
    resume,
    clear,
  };
}
