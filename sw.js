const CACHE_NAME = 'booklist-v100';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css?v=100',
  './css/extensions.css?v=100',
  './css/modern-ui.css?v=100',
  './css/command-palette.css?v=100',
  './js/config.js?v=100',
  './js/core.js?v=100',
  './js/storage.js?v=100',
  './js/media.js?v=100',
  './js/ai.js?v=100',
  './js/bookmarks.js?v=100',
  './js/notes.js?v=100',
  './js/whiteboard.js?v=100',
  './js/features.js?v=100',
  './js/modules/media-catalog.js?v=100',
  './js/personal.js?v=100',
  './js/app.js?v=100',
  './js/modules/page-router.js?v=100',
  './js/modules/technical-registry.js?v=100',
  './js/modules/operational-centers.js?v=100',
  './js/modules/asset-loader.js?v=100',
  './js/modules/accessibility.js?v=100',
  './js/modules/dialogs.js?v=100',
  './js/modules/storage-portability.js?v=100',
  './js/modules/system-health.js?v=100',
  './js/modules/command-palette.js?v=100',
  './js/extensions.js?v=100',
  './js/graph.js?v=100',
  './js/modern-ui.js?v=100',
  './js/markmap-lite.js?v=100',
  './js/rag-chat.js?v=100',
  './js/scanner.js?v=100',
  './js/gamification.js?v=100',
  './js/network-topology.js?v=100',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/supa.txt')) {
    event.respondWith(Promise.resolve(new Response('Not found', { status: 404 })));
    return;
  }
  const isHTML = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // Network-first for HTML so updates are picked up immediately
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
