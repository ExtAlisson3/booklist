const CACHE_NAME = 'booklist-v101';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css?v=101',
  './css/extensions.css?v=101',
  './css/modern-ui.css?v=101',
  './css/command-palette.css?v=101',
  './js/config.js?v=101',
  './js/core.js?v=101',
  './js/storage.js?v=101',
  './js/media.js?v=101',
  './js/ai.js?v=101',
  './js/bookmarks.js?v=101',
  './js/notes.js?v=101',
  './js/whiteboard.js?v=101',
  './js/features.js?v=101',
  './js/modules/media-catalog.js?v=101',
  './js/personal.js?v=101',
  './js/app.js?v=101',
  './js/modules/page-router.js?v=101',
  './js/modules/technical-registry.js?v=101',
  './js/modules/operational-centers.js?v=101',
  './js/modules/asset-loader.js?v=101',
  './js/modules/accessibility.js?v=101',
  './js/modules/dialogs.js?v=101',
  './js/modules/storage-portability.js?v=101',
  './js/modules/system-health.js?v=101',
  './js/modules/command-palette.js?v=101',
  './js/extensions.js?v=101',
  './js/graph.js?v=101',
  './js/modern-ui.js?v=101',
  './js/markmap-lite.js?v=101',
  './js/rag-chat.js?v=101',
  './js/scanner.js?v=101',
  './js/gamification.js?v=101',
  './js/network-topology.js?v=101',
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
