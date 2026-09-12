const CACHE_NAME = "garden-grow-guide-v0-5";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./language.css",
  "./visual.css",
  "./inventory-neighbors.css",
  "./app.js",
  "./manifest.json",
  "./assets/icon.svg",
  "./data/plants.json",
  "./data/plants-current-gardens.json",
  "./data/plants-owned-seeds.json",
  "./data/sources.json",
  "./data/sources-current-gardens.json",
  "./data/sources-owned-seeds.json",
  "./data/translations-es.json",
  "./data/translations-owned-seeds-es.json",
  "./data/visuals.json",
  "./data/seed-inventory.json",
  "./data/neighbor-profiles.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        if (new URL(event.request.url).origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
