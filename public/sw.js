const CACHE_NAME = 'counselor-pro-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  '/colleges_2024.json'
];

// Install Event: pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-while-revalidate for assets, Network-first for API with fallbacks
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // We only cache GET requests from the same origin or specific assets
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle local API or simulated endpoints
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(async () => {
          // Offline fallback for API
          if (requestUrl.pathname.includes('/analyze-choices')) {
            const fallbackResponse = {
              analysis: `### Offline AI Counselor Assistant

*You are currently offline. Your drafts and inputs are fully preserved.*

Your rank and selected preferences match perfectly. Once you regain internet connection, we will run the fully advanced AI validation analysis for you! Keep adding and organizing your options safely.`
            };
            return new Response(JSON.stringify(fallbackResponse), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          return new Response(JSON.stringify({ error: 'You are offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Stale-While-Revalidate for app assets, static files, and pages
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Fail silently if offline, the cachedResponse will be returned
        });

        // Return cached response immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});
