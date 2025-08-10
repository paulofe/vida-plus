// SW Vida+ v5.1.4
const CACHE='vida-plus-v5.1.4';
const APP_SHELL=['icon-96.png','icon-128.png','icon-192.png','icon-512.png','manifest.webmanifest'];

self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch',e=>{ const u=new URL(e.request.url);
  const isApp = u.pathname.endsWith('/')||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/app.js');
  if(isApp){ e.respondWith(fetch(e.request).then(r=>{const c=r.clone(); caches.open(CACHE).then(cc=>cc.put(e.request,c)); return r;}).catch(()=>caches.match(e.request))); }
  else e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
