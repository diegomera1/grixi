import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "~/lib/api-fetch";

// The VAPID public key — must match the one in Cloudflare Workers secrets
const VAPID_PUBLIC_KEY = "BB9IOX6QnG-Q9GFYp-OB_WtceecuFUi_rrxNZ83R5_Lj4fDRdyhHpP040l_uPSg4oHO2QHUV8cuNHXKQnLlPeyo";

interface PushStatus {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  loading: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>({
    supported: false,
    permission: "unsupported",
    subscribed: false,
    loading: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    setStatus((s) => ({
      ...s,
      supported: true,
      permission: Notification.permission,
    }));

    // Check if already subscribed
    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setStatus((s) => ({
          ...s,
          subscribed: !!sub,
        }));
      });
    });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!status.supported) return false;

    setStatus((s) => ({ ...s, loading: true }));

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus((s) => ({ ...s, permission, loading: false }));
        return false;
      }

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      const keys = subscription.toJSON().keys;
      const response = await apiFetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: keys?.p256dh,
            auth: keys?.auth,
          },
        }),
      });

      const ok = response.ok;
      setStatus({
        supported: true,
        permission: "granted",
        subscribed: ok,
        loading: false,
      });

      return ok;
    } catch (err) {
      console.error("[Push] Error:", err);
      setStatus((s) => ({ ...s, loading: false }));
      return false;
    }
  }, [status.supported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!status.subscribed) return true;

    setStatus((s) => ({ ...s, loading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Notify server
        await apiFetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
      }

      setStatus((s) => ({ ...s, subscribed: false, loading: false }));
      return true;
    } catch (err) {
      console.error("[Push] Unsubscribe error:", err);
      setStatus((s) => ({ ...s, loading: false }));
      return false;
    }
  }, [status.subscribed]);

  // Send a local notification (useful for in-app events)
  const sendLocalNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!status.subscribed) return;

      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `grixi-${Date.now()}`,
          ...options,
        });
      });
    },
    [status.subscribed]
  );

  return {
    status,
    requestPermission,
    unsubscribe,
    sendLocalNotification,
  };
}
