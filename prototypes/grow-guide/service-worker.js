const CACHE_NAME = "garden-labs-v0-7-1";
const APP_SHELL = [
  "./",
  "./index.html?v=0.7.1",
  "./styles.css?v=0.7.0",
  "./language.css?v=0.7.0",
  "./visual.css?v=0.7.0",
  "./inventory-neighbors.css?v=0.7.0",
  "./garden-labs.css?v=0.7.0",
  "./app.js?v=0.7.0",
  "./demo-shell.js?v=0.7.0",
  "./manifest.json?v=0.7.1",
  "./assets/lab-icon-approved-180.png",
  "./assets/lab-icon-approved-512.jpg",
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

  const requestUrl = new URL(event.request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => {
          return (await caches.match(event.request)) || (await caches.match("./index.html?v=0.7.1"));
        })
    );
    return;
  }

  if (!sameOrigin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
