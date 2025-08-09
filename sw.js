
const CACHE_NAME = 'vida-plus-v4.4.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-96.png',
  './icon-128.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => { if(k !== CACHE_NAME) return caches.delete(k); })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const respClone = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          if(req.method === 'GET' && (new URL(req.url)).origin === self.location.origin) {
            cache.put(req, respClone).catch(()=>{});
          }
        });
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
