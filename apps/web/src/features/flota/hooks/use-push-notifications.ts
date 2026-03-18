"use client";

import { useState, useEffect, useCallback } from "react";

type PushStatus = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
};

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>({
    supported: false,
    permission: "unsupported",
    subscribed: false,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    setStatus({
      supported: true,
      permission: Notification.permission,
      subscribed: Notification.permission === "granted",
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (!status.supported) return false;

    const permission = await Notification.requestPermission();
    setStatus((prev) => ({
      ...prev,
      permission,
      subscribed: permission === "granted",
    }));

    return permission === "granted";
  }, [status.supported]);

  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!status.subscribed) return;

      // Use service worker notification if available for persistence
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            icon: "/brand/icon-192.png",
            badge: "/brand/icon-192.png",
            tag: `grixi-${Date.now()}`,
            ...options,
          });
        });
      } else {
        new Notification(title, {
          icon: "/brand/icon-192.png",
          ...options,
        });
      }
    },
    [status.subscribed]
  );

  // Alert notification for critical changes
  const alertCritical = useCallback(
    (equipmentName: string, newStatus: string) => {
      sendNotification(`⚠️ Alerta Crítica — ${equipmentName}`, {
        body: `Estado cambió a: ${newStatus}`,
        tag: `critical-${equipmentName}`,
        requireInteraction: true,
      });
    },
    [sendNotification]
  );

  const alertWOOverdue = useCallback(
    (woNumber: string, title: string) => {
      sendNotification(`🔧 OT Vencida — ${woNumber}`, {
        body: title,
        tag: `wo-overdue-${woNumber}`,
      });
    },
    [sendNotification]
  );

  return {
    status,
    requestPermission,
    sendNotification,
    alertCritical,
    alertWOOverdue,
  };
}
