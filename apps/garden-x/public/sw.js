/*
 * Garden X no longer uses a PWA service worker.
 *
 * The previous application registered /sw.js for this same origin. Browsers
 * that still have that worker can continue to serve its cached application
 * shell after the TanStack/Nitro migration. This one-time replacement worker
 * takes control, removes the legacy Cache Storage entries, unregisters itself,
 * and reloads open Garden pages from the network.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await Promise.all((await self.caches.keys()).map((key) => self.caches.delete(key)));
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await self.registration.unregister();
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    })(),
  );
});
