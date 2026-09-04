/* Service worker de Alerta Trading.

   Su único trabajo es que la app abra siempre, incluso sin internet.
   Regla que nunca se rompe: los datos de mercado JAMÁS se guardan en caché.
   Un precio viejo servido desde disco daría señales falsas, así que todo lo
   que no sea de este mismo origen se deja pasar directo a la red.
*/

const VERSION = '1.4.0';
const CACHE = `alerta-trading-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.ico',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll falla entero si un archivo falta; se guarda uno por uno
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Bybit y cualquier otro origen: directo a la red, sin tocar ni guardar nada.
  if (url.origin !== self.location.origin) return;

  const esPagina = req.mode === 'navigate' ||
                   url.pathname.endsWith('/') ||
                   url.pathname.endsWith('.html');

  if (esPagina) {
    // Red primero: así una versión nueva llega en cuanto hay conexión.
    e.respondWith(
      fetch(req)
        .then(r => {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // Íconos y manifiesto: caché primero, que no cambian casi nunca.
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      return r;
    }))
  );
});
