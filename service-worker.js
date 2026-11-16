/* Musical Madman service worker
   - Offline caching (network-first, so new versions of index.html show up right away)
   - Notification click + push handlers (needed for reminders on iPhone/iPad) */

const CACHE_NAME = 'musical-madman-1.25';   // bump this when you want to force a cache reset
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './future-192.png',
  './future-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})            // don't fail install if one file is missing
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Network first, fall back to cache when offline
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});

// Tapping a notification opens / focuses the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (let i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// Ready for a real Web Push server: every push must show a notification on iOS
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (_) { d = { body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Musical Madman', {
      body: d.body || 'Time to practice 🎼',
      tag: d.tag || 'mm-reminder',
      renotify: true,
      icon: 'future-192.png',
      badge: 'future-192.png',
      data: { url: d.url || './' }
    })
  );
});
