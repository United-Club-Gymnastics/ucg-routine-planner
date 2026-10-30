// Service worker for the UCG Routine Planner (generated into _site/sw.js by
// tools/build_site.mjs; not used in development).
//
// Each build is one version: on install it stores every file of that build (the page,
// code, fonts, worksheets) so the planner opens instantly and works offline. Pages are
// always served by the version that's running, so code from two builds never mixes:
//   - the page itself (navigations; privacy.html as itself) and every file: from this version's cache first,
//     the network only for anything not cached;
//   - other sites (Google sign-in, the database) are never touched.
// A new deploy installs alongside and waits; the page shows "Update available" and
// switches when the user reloads (or when every tab of the old version has closed).
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `rp-${VERSION}`;
const KEEP = 3; // recent versions kept, so a still-open older page can load its lazy parts

// The site's pages other than the planner (calibration/infinity/, ...): their own index.html.
const PAGES = FILES.filter((f) => f.endsWith('/index.html'));

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })));
      // A device can still be running an older worker (it waits for the planner's tabs to close),
      // and an older worker answers a page it doesn't know with the planner, which can't load
      // from a folder. Give the older versions' caches these pages, under the names they look
      // up (the folder, and the folder without its slash as a redirect), so a reload shows them.
      for (const key of await caches.keys()) {
        if (!key.startsWith('rp-') || key === 'rp-meta' || key === CACHE) continue;
        const old = await caches.open(key);
        for (const f of PAGES) {
          const folder = f.slice(0, -'index.html'.length);
          const page = await cache.match(f);
          if (!page || (await old.match(folder))) continue;
          await old.put(folder, page.clone());
          await old.put(folder.slice(0, -1), Response.redirect(new URL(folder, self.registration.scope).href, 302));
        }
      }
    })()
  );
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
        // The site's other pages (privacy.html, calibration/infinity/) are served as themselves;
        // a folder without its trailing slash is redirected to it first, as GitHub Pages does,
        // so the page's relative links resolve.
        const page = url.pathname.slice(scope.pathname.length);
        if (page && page !== 'index.html') {
          const own = await cache.match(page.endsWith('/') ? `${page}index.html` : page);
          if (own) return own;
          if (!page.endsWith('/') && (await cache.match(`${page}/index.html`))) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 302);
        }
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
