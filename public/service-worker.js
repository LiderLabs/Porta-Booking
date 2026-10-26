// porta-booking service worker.
// Network first, so a new deploy is picked up straight away. The cache is only a fallback for
// when the device is offline. (The old version served the cached page forever, so the kiosk
// could keep running an old build, or break when old asset files were removed.)
const CACHE_NAME = 'porta-booking-v2';
const PRECACHE = ['/Porta.png', '/Porta_fav.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || PRECACHE.includes(url.pathname))) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req.mode === 'navigate' ? '/' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? '/' : req))
  );
});
