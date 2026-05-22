/**
 * Tabibi Service Worker v12 — Production
 * Stratégies : HTML network-first, assets cache-first, Supabase bypass.
 * Bump v12 : Phase 4.B.3-fix1 (robustness blocages : cache invalidation,
 *            logs console explicites, always-toast, retry sur session pas prête,
 *            garde res.data null pour edge case PostgREST)
 */
const CACHE_VERSION = 'tabibi-v12-2026-05-22';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

const PRECACHE_URLS = [
  '/', '/index.html', '/login.html', '/signup.html',
  '/offline.html', '/404.html', '/manifest.json', '/favicon.ico',
  '/styles/app.css', '/styles/components.css',
  '/images/icon-192.png', '/images/icon-512.png',
  // [Phase 4.B.2] helpers médecin partagés (cache-first via runtime suffit,
  // mais on précache pour zéro latence au 1er affichage du dashboard)
  '/js/tabibi-doctor-dashboard.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(err => console.warn('[SW] Precache partial:', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) return;
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (/\.(css|js|png|jpg|jpeg|gif|webp|svg|woff2?|ttf|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, fresh.clone()).catch(()=>{});
    return fresh;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    return new Response('Hors ligne', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) {
    fetch(req).then(fresh => {
      if (fresh && fresh.status === 200) {
        caches.open(RUNTIME_CACHE).then(c => c.put(req, fresh));
      }
    }).catch(()=>{});
    return cached;
  }
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, fresh.clone()).catch(()=>{});
    }
    return fresh;
  } catch (err) {
    return new Response('', { status: 504 });
  }
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
