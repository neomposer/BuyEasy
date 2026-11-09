// BuyEasy service worker. Bump CACHE_VERSION on every deploy so phones never keep old code.
const CACHE_VERSION = 'buyeasy-v5-2026-11-09';
const SHELL = ['/offline.html', '/icon-192.png', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Supabase, maps, CDNs: never cached here
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && !url.pathname.startsWith('/admin/')) { const copy = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('/offline.html') : undefined)))
  );
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => { if (list.length) return list[0].focus(); return self.clients.openWindow('/index.html'); }));
});
