/* WORLD INDUSTRY service worker
 * 方針: ネットワーク優先・失敗時はキャッシュ（オフラインでも最後に開いた版が動く）。
 * ビルドごとにファイル名（ハッシュ）が変わるため、事前キャッシュ一覧は持たず実行時に貯める。
 */
// カード100種の入れ替えと、保存先の作り直しに合わせて v2 に上げた。
// 名前を変えると activate で古いキャッシュが全部消えるので、前の版の絵が残らない。
const CACHE = 'world-industry-runtime-v2';

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
  // 音声は途中から読む（Range）リクエストが来る。206 の部分応答を貯めると壊れるので、そのまま通す
  if (req.headers.has('range')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.status === 200 && res.type === 'basic') {
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
