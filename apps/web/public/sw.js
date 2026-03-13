/// <reference lib="webworker" />

const CACHE_VERSION = "grixi-v2";
const STATIC_ASSETS = [
  "/brand/icon.png",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/offline",
];

// Install — cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
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

// Fetch — network-first for pages, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and external requests
  if (request.method !== "GET" || !url.origin.includes(self.location.origin)) {
    return;
  }

  // Skip _next/data and API routes — always network
  if (
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Static assets — cache first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2|css|js)$/)
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

  // Pages — network first, fallback to cache, then offline
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
  event.respondWith(fetch(request).catch(() => new Response("", { status: 408 })));
});
