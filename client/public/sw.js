// Minimal service worker so Android can install Bongo Life as an app.
// It deliberately caches nothing: the game is live/multiplayer and every deploy must show at once.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
