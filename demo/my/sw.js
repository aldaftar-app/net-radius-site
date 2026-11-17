// «حسابي»: shows the network's notifications on the phone (Web Push), also when «حسابي» is closed.
// Nothing is cached here: «حسابي» always shows what the server says now.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'حسابي', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, dir: 'auto',
    icon: '/my/icon-192.png', badge: '/my/badge-72.png', data: { url: d.url || '/my/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/my/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(`${self.location.origin}/my/`) && 'focus' in c) {
        return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(url).catch(() => w) : w));
      }
    }
    return self.clients.openWindow(url);
  }));
});
