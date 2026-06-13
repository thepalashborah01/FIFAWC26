// Minimal service worker: caches the app shell so the app is installable
// and opens instantly. Live data (data.json) is always fetched fresh from
// the network, never served stale from cache.
const CACHE = "wc26-shell-v1";
const SHELL = ["./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Always go to network for the live data file.
  if (url.pathname.endsWith("data.json")) return;
  // App shell: cache-first, fall back to network.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
