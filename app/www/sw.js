// 오프라인 실행용 캐시. 같은 출처 파일만 캐시하고, 버전을 올리면 옛 캐시를 지운다.
const V = 'mc-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // 외부(폰트)는 브라우저 기본 동작
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
