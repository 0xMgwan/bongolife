// Minimal service worker: lets Android/iOS install Bongo Life as an app and receive push notifications.
// It deliberately caches nothing: the game is live/multiplayer and every deploy must show at once.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// Push from the server (messages, sales, hiring…) while the game is closed.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Bongo Life', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'bongo',
    renotify: true,
    data: { url: d.url || '/' },
  }));
});

// Tapping a notification: bring the game forward (opening a DM if it was one), or open it.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const url = data.url || (data.dm ? `/?dm=${encodeURIComponent(data.dm)}` : '/');
  const dm = data.dm || new URL(url, self.location.origin).searchParams.get('dm');
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins[0];
    if (win) {
      await win.focus();
      if (dm) win.postMessage({ type: 'open-dm', from: dm });
    } else {
      await self.clients.openWindow(url);
    }
  })());
});
