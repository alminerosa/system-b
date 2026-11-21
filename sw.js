// Service worker : permet d'ouvrir l'appli même avec une mauvaise connexion.
// Stratégie « réseau d'abord » : tu as toujours la dernière version si tu es en ligne,
// et la copie en cache sinon. Les appels à Supabase ne passent pas par ici.
const CACHE = 'systeme-b-v1';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'config.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const handled = url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net';
  if (!handled) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
