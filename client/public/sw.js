// Minimal service worker so Android can install Bongo Life as an app.
// It deliberately caches nothing: the game is live/multiplayer and every deploy must show at once.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// Tapping a message notification: bring the game forward and open that conversation.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const from = e.notification.data?.dm;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins[0];
    if (win) {
      await win.focus();
      if (from) win.postMessage({ type: 'open-dm', from });
    } else {
      await self.clients.openWindow(from ? `/?dm=${encodeURIComponent(from)}` : '/');
    }
  })());
});
