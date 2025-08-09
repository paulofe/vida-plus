// Vida+ PWA SW v4.4.2
const CACHE = 'vida-plus-v4.4.2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-96.png',
  './icon-128.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
