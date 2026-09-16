/* WORLD INDUSTRY service worker
 * 方針: ネットワーク優先・失敗時はキャッシュ（オフラインでも最後に開いた版が動く）。
 * ビルドごとにファイル名（ハッシュ）が変わるため、事前キャッシュ一覧は持たず実行時に貯める。
 */
const CACHE = 'world-industry-runtime-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const index = await caches.match(new URL('./', self.registration.scope).toString());
          if (index) return index;
        }
        return Response.error();
      }),
  );
});
