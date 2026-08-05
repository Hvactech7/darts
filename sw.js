// Retirement worker for the OLD root-scope service worker.
//
// Dart Keeper used to be served from "/" and registered a stale-while-revalidate
// worker at this exact URL with scope "/". Its fetch handler was
// `return cached || network`, so on every visit it answered "/" from cache —
// which means a returning visitor would be handed the cached APP forever and
// would never see the new landing page.
//
// Browsers re-fetch the worker script on navigation. They get THIS file instead,
// see it differs byte-for-byte from the old one, and install it. It then wipes
// every cache, unregisters itself, and reloads any open window so the real page
// is fetched from the network. After that, "/" has no worker at all.
//
// The app's own worker now lives at /play/sw.js with scope /play/ and is a
// completely separate registration — nothing here touches it.

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
    try {
      var clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function (c) { if (c.url.indexOf('/play/') === -1) c.navigate(c.url); });
    } catch (err) {}
  })());
});

// Pass everything straight to the network while this worker is still alive.
self.addEventListener('fetch', function (e) {
  e.respondWith(fetch(e.request));
});
