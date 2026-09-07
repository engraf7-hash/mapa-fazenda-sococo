// Service Worker do app "Campo — Mapa da Fazenda"
// Estratégia:
//  - App shell (HTML/CSS/JS/dados) -> cache-first, atualizado a cada nova versão (CACHE_NAME).
//  - Ladrilhos de mapa (OpenStreetMap / Esri) -> cache-first "cresce com o uso":
//    todo ladrilho visitado com internet fica salvo e volta a ser servido offline.

const CACHE_NAME = 'campo-fazenda-v2';
const TILE_CACHE = 'campo-fazenda-tiles-v1';

const APP_SHELL = [
  './',
  './index.html',
  './data.js',
  './manifest.json',
  './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdn.jsdelivr.net/npm/shpjs@4.0.4/dist/shp.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Se algum recurso externo falhar no install (ex: offline na primeira instalação),
      // não bloqueia o restante do app shell.
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== TILE_CACHE)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

function isTileRequest(url) {
  return (
    url.includes('tile.openstreetmap.org') ||
    url.includes('arcgisonline.com')
  );
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (isTileRequest(url)) {
    // Ladrilhos de mapa: cache-first, com atualização em segundo plano quando online.
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const network = fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // App shell e demais recursos: cache-first, com fallback de rede.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && event.request.method === 'GET') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached)
      );
    })
  );
});
