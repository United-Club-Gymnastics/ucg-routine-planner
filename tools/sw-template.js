// Service worker for the UCG Routine Planner (generated into _site/sw.js by
// tools/build_site.mjs; not used in development).
//
// Each build is one version: on install it stores every file of that build (the page,
// code, fonts, worksheets) so the planner opens instantly and works offline. Pages are
// always served by the version that's running, so code from two builds never mixes:
//   - the page itself (navigations) and every file: from this version's cache first,
//     the network only for anything not cached;
//   - other sites (Google sign-in, the database) are never touched.
// A new deploy installs alongside and waits; the page shows "Update available" and
// switches when the user reloads (or when every tab of the old version has closed).
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `rp-${VERSION}`;
const KEEP = 3; // recent versions kept, so a still-open older page can load its lazy parts

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const meta = await caches.open('rp-meta');
      const seen = await meta.match('versions');
      const versions = [VERSION, ...((seen && (await seen.json())) || []).filter((v) => v !== VERSION)].slice(0, KEEP);
      await meta.put('versions', new Response(JSON.stringify(versions)));
      for (const key of await caches.keys()) {
        if (key.startsWith('rp-') && key !== 'rp-meta' && !versions.includes(key.slice(3))) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (req.mode === 'navigate') {
        // The app is one page: serve this version's copy (query strings like ?local don't matter).
        return (await cache.match('index.html')) || fetch(req);
      }
      // This version's files first, then any recent version's (an older open page), then the network.
      const hit = (await cache.match(req)) || (await caches.match(req));
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    })()
  );
});
