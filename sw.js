// Service worker: guarda a app em cache para funcionar sem internet.
const CACHE = 'contas-turbo-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/storage.js', './js/fx.js',
  './js/math/rational.js', './js/math/expr.js', './js/math/steps.js', './js/math/rng.js',
  './js/math/generators.js', './js/math/distractors.js', './js/math/answer.js',
  './js/game/session.js', './js/game/achievements.js',
  './js/ui/common.js', './js/ui/keypad.js', './js/ui/duel.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Rede primeiro (para apanhar atualizações), cache se estiver sem internet.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        } else if (res.ok && e.request.url.includes('fonts.g')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((r) => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))),
  );
});
