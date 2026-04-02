/// <reference lib="webworker" />

// Cache version — update this on each deploy to bust stale caches
const CACHE_VERSION = "grixi-v2026-04-02";
const STATIC_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/grixi-logo.png",
  "/offline",
];

// ─── Install: cache core static assets ───────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("grixi-") && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: strategy per request type ────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== "GET") return;

  // Skip external requests
  if (url.origin !== self.location.origin) return;

  // Skip API routes — always network (never cache dynamic data)
  if (url.pathname.startsWith("/api/")) return;

  // Skip auth routes
  if (url.pathname.startsWith("/auth/")) return;

  // Static assets — cache first
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/build/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2|css|js|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // HTML pages — network first, fallback to cache, then offline
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/offline"))
        )
    );
    return;
  }

  // Everything else — network only, silent fail
  event.respondWith(
    fetch(request).catch(() => new Response("", { status: 408 }))
  );
});

// ─── Push Notifications ──────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "GRIXI",
      body: event.data.text(),
      icon: "/icon-192.png",
    };
  }

  const { title = "GRIXI", body, icon = "/icon-192.png", badge = "/icon-192.png", url = "/dashboard", tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: tag || `grixi-${Date.now()}`,
      data: { url },
      vibrate: [100, 50, 100],
      actions: [
        { action: "open", title: "Ver" },
        { action: "dismiss", title: "Cerrar" },
      ],
    })
  );
});

// ─── Notification Click — navigate to URL ────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Messages ────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
