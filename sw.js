// Vida+ PWA SW v4.7.1
const CACHE = 'vida-plus-v4.7.1';
const APP_SHELL = ['icon-96.png','icon-128.png','icon-192.png','icon-512.png','manifest.webmanifest'];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  const isApp = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/app.js');
  if(isApp){
    e.respondWith(fetch(e.request).then(resp=>{
      const copy = resp.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy));
      return resp;
    }).catch(()=>caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(res=>res||fetch(e.request)));
  }
});
