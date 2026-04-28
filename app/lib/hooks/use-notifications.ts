import { useState, useEffect, useCallback, useRef } from "react";
import { useRealtimeSubscription } from "./use-realtime";
import { apiFetch } from "~/lib/api-fetch";

// ═══════════════════════════════════════════════════════════
// useNotifications — Hook completo para sistema de notificaciones
//
// Carga notificaciones del servidor, mantiene conteo de no leídas,
// se actualiza en tiempo real via Supabase Realtime.
//
// Uso:
//   const { notifications, unreadCount, markAsRead, markAllRead, deleteNotification } = 
//     useNotifications(orgId);
// ═══════════════════════════════════════════════════════════

export interface Notification {
  id: string;
  user_id: string;
  organization_id: string;
  title: string;
  body: string | null;
  icon: string;
  type: "info" | "success" | "warning" | "error" | "action";
  module: string;
  action_url: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAll: () => Promise<void>;
  refresh: () => Promise<void>;
  isLive: boolean;
}

// Module-level dedup cache to avoid double HTTP fetch
const pendingFetches = new Map<string, Promise<any>>();

function fetchNotificationsDedup(orgId: string): Promise<any> {
  const key = `notifs:${orgId}`;
  const existing = pendingFetches.get(key);
  if (existing) return existing;

  const promise = apiFetch(`/api/notifications?orgId=${orgId}&limit=50`)
    .then((res) => {
      if (!res.ok) throw new Error("Error cargando notificaciones");
      return res.json();
    })
    .finally(() => {
      pendingFetches.delete(key);
    });

  pendingFetches.set(key, promise);
  return promise;
}

export function useNotifications(orgId: string | null | undefined): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const initialLoadDone = useRef(false);

  // Module-level dedup: avoid double fetch when hook mounts in layout + page
  const fetchNotifications = useCallback(async () => {
    if (!orgId) return;

    if (!initialLoadDone.current) setLoading(true);

    try {
      const data = await fetchNotificationsDedup(orgId);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setTotalCount(data.total);
      setError(null);
      initialLoadDone.current = true;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Initial load
  useEffect(() => {
    initialLoadDone.current = false;
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime: listen for new notifications for this org
  useRealtimeSubscription({
    table: "notifications",
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    enabled: !!orgId,
    onInsert: (payload) => {
      const newNotif = payload.new as Notification;
      setNotifications((prev) => [newNotif, ...prev]);
      if (!newNotif.read_at) {
        setUnreadCount((c) => c + 1);
      }
      setTotalCount((c) => c + 1);
      setIsLive(true);

      // Show browser native notification (push-like when app is open)
      if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
        try {
          navigator.serviceWorker?.ready?.then((reg) => {
            reg.showNotification(newNotif.title, {
              body: newNotif.body || "",
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: `grixi-${newNotif.id}`,
              data: { url: newNotif.action_url || "/notificaciones" },
            });
          }).catch(() => {
            // Fallback: direct Notification API
            new window.Notification(newNotif.title, {
              body: newNotif.body || "",
              icon: "/icon-192.png",
              tag: `grixi-${newNotif.id}`,
            });
          });
        } catch {}
      }
    },
    onUpdate: (payload) => {
      const updated = payload.new as Notification;
      setNotifications((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
          .filter((n) => !n.archived_at)
      );
      // Recalculate unread
      setNotifications((prev) => {
        const unread = prev.filter((n) => !n.read_at && !n.archived_at).length;
        setUnreadCount(unread);
        return prev;
      });
      setIsLive(true);
    },
    onDelete: (payload) => {
      const deleted = payload.old as Notification;
      setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
      setTotalCount((c) => Math.max(0, c - 1));
      if (!deleted.read_at) setUnreadCount((c) => Math.max(0, c - 1));
      setIsLive(true);
    },
  });

  // Actions
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", notificationId: id }),
      });
    } catch {
      // Revert on error
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    if (!orgId) return;

    // Optimistic
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "readAll", orgId }),
      });
    } catch {
      fetchNotifications();
    }
  }, [orgId, fetchNotifications]);

  const deleteNotification = useCallback(async (id: string) => {
    // Optimistic
    const deleted = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotalCount((c) => Math.max(0, c - 1));
    if (deleted && !deleted.read_at) setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", notificationId: id }),
      });
    } catch {
      fetchNotifications();
    }
  }, [notifications, fetchNotifications]);

  const deleteAll = useCallback(async () => {
    if (!orgId) return;

    setNotifications([]);
    setUnreadCount(0);
    setTotalCount(0);

    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteAll", orgId }),
      });
    } catch {
      fetchNotifications();
    }
  }, [orgId, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    totalCount,
    loading,
    error,
    markAsRead,
    markAllRead,
    deleteNotification,
    deleteAll,
    refresh: fetchNotifications,
    isLive,
  };
}
