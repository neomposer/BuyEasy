// BuyEasy service worker. Bump CACHE_VERSION on every deploy so phones never keep old code.
const CACHE_VERSION = 'buyeasy-v12-2026-11-18';
// Works at the top of a site (Netlify) AND inside a folder (GitHub Pages): all paths are relative to this file.
const BASE = new URL('./', self.location).href;
const at = p => new URL(p, BASE).href;
const SHELL = ['offline.html', 'icon-192.png', 'manifest.json'];

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
      if (res && res.ok && !url.href.startsWith(at('admin/'))) { const copy = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match(at('offline.html')) : undefined)))
  );
});
// ---- push notifications (work even when the app is closed) ----
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'BuyEasy', body: e.data ? e.data.text() : '' }; }
  const ring = !!d.ring;
  e.waitUntil(self.registration.showNotification(d.title || 'BuyEasy', {
    body: d.body || '', icon: at('icon-192.png'), badge: at('icon-192.png'),
    tag: d.tag || undefined, renotify: !!d.tag, requireInteraction: ring,
    vibrate: ring ? [500, 200, 500, 200, 500, 200, 500] : [200],
    data: { url: at(String(d.url || '').replace(/^\/+/, '') || 'index.html') }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || at('index.html');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { if (c.url === url || c.url.split('#')[0] === url) return c.focus(); } }
    if (list.length && 'navigate' in list[0]) return list[0].focus().then(w => w.navigate(url));
    return self.clients.openWindow(url);
  }));
});
