// Darts Scorekeeper service worker — offline cache + auto-update.
// Strategy: stale-while-revalidate. The app loads instantly from cache (works
// fully offline), and in the background it fetches the latest from the network
// and updates the cache, so a new version appears the next time it's opened
// while online. Bump CACHE when the file list below changes.
const CACHE = 'darts-v13';
const CORE = ['./', 'index.html', 'manifest.json', 'darts-icon-180.png', 'darts-icon-512.png',  './dk-banner.jpg',
  './dk-bg.jpg'
,  './dk-side-blue.jpg',
  './dk-side-red.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
