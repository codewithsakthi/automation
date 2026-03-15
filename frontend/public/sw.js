// Service Worker for SPARK PWA
// Cache strategy:
//   - Static assets (JS, CSS, images, fonts): Cache-First
//   - Navigation (HTML): Network-First with cache fallback
//   - API calls: Network-First, cache safe GET responses (JSON, non-auth)
//   - Everything else: Network only

const CACHE_NAME = 'spark-static-v1';
const API_CACHE_NAME = 'spark-api-v1';

// Assets to pre-cache during install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/android/launchericon-192x192.png',
  '/icons/android/launchericon-512x512.png',
  '/icons/ios/180.png',
];

// API paths that should NEVER be cached (auth-sensitive)
const NEVER_CACHE_PATTERNS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/token',
];

function broadcastMessage(message) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage(message));
  });
}

// Allow the app to trigger immediate activation when a new SW is waiting.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Install: Pre-cache static shell ───────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        // Don't fail install if some assets are missing in dev
        console.warn('[SW] Pre-cache partial failure (OK in dev):', err);
      });
    })
  );
  // Activate immediately without waiting for old SW to unload
  self.skipWaiting();
});

// ─── Activate: Clean up old caches ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );

  // Claim all open clients so updated SW takes effect immediately
  self.clients.claim();
  broadcastMessage({ type: 'SW_ACTIVATED' });
});

// ─── Fetch: Route requests to the right strategy ───────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests entirely
  if (request.method !== 'GET') return;

  // Skip chrome-extension, browser-internal, etc.
  if (!url.protocol.startsWith('http')) return;

  // ── Auth-sensitive API endpoints: Network only, never cache ──
  const isAuthEndpoint = NEVER_CACHE_PATTERNS.some((pattern) =>
    url.pathname.includes(pattern)
  );
  if (isAuthEndpoint) return; // fall through to browser default

  // ── API calls (external backend or /api/* paths) ──
  const isApiCall =
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('railway.app') ||
    url.hostname.includes('vercel.app');

  if (isApiCall) {
    event.respondWith(networkFirstWithApiCache(request));
    return;
  }

  // ── Static assets: JS, CSS, images, fonts → Cache-First ──
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|ico)$/.test(
    url.pathname
  );
  if (isStaticAsset) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ── Navigation requests (HTML routes) → Network-First ──
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithStaticCache(request));
    return;
  }
});

// ─── Strategy: Cache-First ──────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Nothing in cache and network failed
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// ─── Strategy: Network-First with static cache fallback (navigations) ───────
async function networkFirstWithStaticCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline: serve the cached SPA shell
    const cached =
      (await caches.match(request)) || (await caches.match('/index.html'));
    return cached || new Response('Offline', { status: 503 });
  }
}

// ─── Strategy: Network-First with API cache (non-auth GET responses) ────────
async function networkFirstWithApiCache(request) {
  try {
    const response = await fetch(request);

    const contentType = response.headers.get('content-type') ?? '';
    const shouldCache =
      response.ok &&
      contentType.includes('application/json');

    if (shouldCache) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    // Network failed: try serving stale cached data
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Serving stale API cache for:', request.url);
      return cached;
    }
    return new Response(
      JSON.stringify({ error: 'You are offline. Please reconnect.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
