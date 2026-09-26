/* Service Worker: App-Shell und Kartenliste offline verfügbar halten. */
// __BUILD__ wird beim Deploy durch den Commit-SHA ersetzt (.github/workflows/deploy.yml).
const VERSION = '__BUILD__';
const SHELL   = `neandertaler-shell-${VERSION}`;

const SHELL_FILES = [
  './',
  'index.html',
  'kontakt.html',
  'css/style.css',
  'js/deck.js',
  'js/app.js',
  'data/cards.de.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('neandertaler-shell-') && k !== SHELL)
                          .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigationen: Netz zuerst, sonst die gecachte Shell.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(req); }
      catch { return (await caches.match(req)) || (await caches.match('index.html')) || Response.error(); }
    })());
    return;
  }

  // Statische Dateien: Cache zuerst, im Hintergrund auffrischen.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(async (res) => {
      if (res && res.ok) (await caches.open(SHELL)).put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
