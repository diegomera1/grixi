"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── IndexedDB helper ────────────────────────────

const DB_NAME = "grixi-flota-offline";
const DB_VERSION = 1;
const STORES = {
  QUEUE: "offline_queue",
  CACHE: "data_cache",
  META: "sync_meta",
} as const;

type OfflineQueueItem = {
  id: string;
  entity_type: string;
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  created_at: string;
  retries: number;
};

type SyncMeta = {
  key: string;
  last_synced_at: string | null;
  last_connected_at: string | null;
  pending_count: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.QUEUE)) {
        db.createObjectStore(STORES.QUEUE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        db.createObjectStore(STORES.CACHE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addToQueue(item: OfflineQueueItem): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.QUEUE, "readwrite");
  tx.objectStore(STORES.QUEUE).put(item);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueue(): Promise<OfflineQueueItem[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.QUEUE, "readonly");
  const store = tx.objectStore(STORES.QUEUE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.QUEUE, "readwrite");
  tx.objectStore(STORES.QUEUE).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getSyncMeta(): Promise<SyncMeta> {
  const db = await openDB();
  const tx = db.transaction(STORES.META, "readonly");
  const store = tx.objectStore(STORES.META);
  return new Promise((resolve) => {
    const request = store.get("sync_status");
    request.onsuccess = () =>
      resolve(
        request.result || {
          key: "sync_status",
          last_synced_at: null,
          last_connected_at: null,
          pending_count: 0,
        }
      );
    request.onerror = () =>
      resolve({
        key: "sync_status",
        last_synced_at: null,
        last_connected_at: null,
        pending_count: 0,
      });
  });
}

async function updateSyncMeta(meta: Partial<SyncMeta>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.META, "readwrite");
  const current = await getSyncMeta();
  tx.objectStore(STORES.META).put({ ...current, ...meta, key: "sync_status" });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function cacheData(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.CACHE, "readwrite");
  tx.objectStore(STORES.CACHE).put({ key, data, cached_at: new Date().toISOString() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getCachedData<T>(key: string): Promise<{ data: T; cached_at: string } | null> {
  const db = await openDB();
  const tx = db.transaction(STORES.CACHE, "readonly");
  const store = tx.objectStore(STORES.CACHE);
  return new Promise((resolve) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

// ── Main Hook ───────────────────────────────────

export type OfflineStatus = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastConnectedAt: string | null;
  timeSinceSync: string;
};

export function useOfflineSync() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    lastConnectedAt: null,
    timeSinceSync: "—",
  });
  const syncingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Calculate human-readable time since last sync
  const calcTimeSinceSync = useCallback((lastSynced: string | null): string => {
    if (!lastSynced) return "Nunca sincronizado";
    const diff = Date.now() - new Date(lastSynced).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Hace un momento";
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  }, []);

  // Refresh status from IndexedDB
  const refreshStatus = useCallback(async () => {
    try {
      const meta = await getSyncMeta();
      const queue = await getQueue();
      setStatus((prev) => ({
        ...prev,
        pendingCount: queue.length,
        lastSyncedAt: meta.last_synced_at,
        lastConnectedAt: meta.last_connected_at,
        timeSinceSync: calcTimeSinceSync(meta.last_synced_at),
      }));
    } catch {
      // IndexedDB not available (SSR or incognito)
    }
  }, [calcTimeSinceSync]);

  // Queue an offline action
  const queueAction = useCallback(
    async (entityType: string, action: "create" | "update" | "delete", payload: Record<string, unknown>) => {
      const item: OfflineQueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        entity_type: entityType,
        action,
        payload,
        created_at: new Date().toISOString(),
        retries: 0,
      };
      await addToQueue(item);
      await refreshStatus();
      return item.id;
    },
    [refreshStatus]
  );

  // Sync pending items (simulated for demo)
  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setStatus((prev) => ({ ...prev, isSyncing: true }));

    try {
      const queue = await getQueue();

      for (const item of queue) {
        // Simulate API call delay
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));

        // In production, this would POST to Supabase
        // await supabase.from('fleet_offline_queue').insert(item);

        await removeFromQueue(item.id);
      }

      const now = new Date().toISOString();
      await updateSyncMeta({
        last_synced_at: now,
        last_connected_at: now,
        pending_count: 0,
      });
    } catch (err) {
      console.error("[OfflineSync] Sync failed:", err);
    } finally {
      syncingRef.current = false;
      setStatus((prev) => ({ ...prev, isSyncing: false }));
      await refreshStatus();
    }
  }, [refreshStatus]);

  // Cache module data for offline access
  const cacheModuleData = useCallback(async (key: string, data: unknown) => {
    await cacheData(key, data);
  }, []);

  // Get cached data
  const getOfflineData = useCallback(async <T,>(key: string) => {
    return getCachedData<T>(key);
  }, []);

  // Online/Offline listeners
  useEffect(() => {
    const handleOnline = async () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      await updateSyncMeta({ last_connected_at: new Date().toISOString() });
      // Auto-sync when back online
      syncNow();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initialize
    refreshStatus();

    // Periodic refresh every 30s
    intervalRef.current = setInterval(refreshStatus, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshStatus, syncNow]);

  return {
    status,
    queueAction,
    syncNow,
    cacheModuleData,
    getOfflineData,
  };
}
