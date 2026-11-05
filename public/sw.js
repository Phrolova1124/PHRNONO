const CACHE_PREFIX = "phrnono-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const OFFLINE_DOCUMENT = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(new Request(OFFLINE_DOCUMENT, { cache: "reload" }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

async function offlineResponse() {
  const cache = await caches.open(CACHE_NAME);
  const cachedPage = await cache.match(OFFLINE_DOCUMENT);
  if (cachedPage) return cachedPage;

  return new Response(
    "<!doctype html><title>PHRNONO | Offline</title><h1>You are offline</h1><p>Reconnect, then reload this page.</p>",
    { headers: { "content-type": "text/html; charset=UTF-8" } },
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch {
      return offlineResponse();
    }
  })());
});
