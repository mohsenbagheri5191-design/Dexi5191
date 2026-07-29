/* Pin Drop service worker — offline shell for the installable PWA.
   Network-first for the app HTML so updates land; cache-first for the icons.
   Map tiles / fonts / photos are always fetched live (never cached here). */
const CACHE = 'pinly-v11';
const SHELL = ['./', './index.html', './icon-192.png', './icon-512.png', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // only same-origin GETs
  // App HTML: network-first so new versions ship
  if (e.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    e.respondWith(fetch(e.request).then((r) => { caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))));
    return;
  }
  // Static assets: cache-first
  e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request)));
});
