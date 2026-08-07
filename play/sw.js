// Dart Keeper service worker — offline cache + same-launch updates.
//
// Strategy (changed 2026-08-07): the APP ITSELF is network-first with a short
// timeout, so opening the app while online always lands on the newest version —
// no more "close it and open it a few times". If the network is missing or slow
// it falls straight back to the cached copy, so offline launches are unaffected.
// Everything else (art, icons, manifest) stays cache-first with a background
// refresh, which is what keeps startup instant.
//
// Bump CACHE when the file list below changes.
const CACHE = 'darts-v20';
const CORE = ['./', 'index.html', 'manifest.json', 'darts-icon-180.png', 'darts-icon-512.png',  './dk-banner.jpg',
  './dk-bg.jpg'
,  './dk-side-blue.jpg',
  './dk-side-red.jpg'
];

// How long to wait for a fresh copy of the app before using the cached one.
// Short enough that a dead connection never leaves the user staring at nothing.
const APP_TIMEOUT = 2000;

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

// Is this the app document itself (as opposed to an image/font/manifest)?
function isAppShell(req) {
  if (req.mode === 'navigate') return true;
  const p = new URL(req.url).pathname;
  return p.endsWith('/') || p.endsWith('/index.html');
}

function putInCache(req, resp) {
  const clone = resp.clone();
  caches.open(CACHE).then((c) => c.put(req, clone));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (isAppShell(req)) {
    // NETWORK-FIRST — the whole point: a launch with signal gets today's build.
    e.respondWith(new Promise((resolve) => {
      let settled = false;
      const done = (r) => { if (!settled && r) { settled = true; resolve(r); } };

      // If the network hasn't answered in time, serve the cached app instead.
      const timer = setTimeout(() => { caches.match(req).then(done); }, APP_TIMEOUT);

      fetch(req).then((resp) => {
        clearTimeout(timer);
        if (resp && resp.status === 200) {
          putInCache(req, resp);           // cache it even if we already served
          done(resp);                       // the cached copy on timeout
        } else {
          caches.match(req).then((c) => done(c || resp));
        }
      }).catch(() => {                      // offline / DNS failure
        clearTimeout(timer);
        caches.match(req).then((c) => done(c || Response.error()));
      });
    }));
    return;
  }

  // Everything else: instant from cache, refreshed in the background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((resp) => {
        if (resp && resp.status === 200) putInCache(req, resp);
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
