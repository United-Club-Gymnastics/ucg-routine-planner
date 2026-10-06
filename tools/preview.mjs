// Serves the production build (_site/) the way GitHub Pages does, under
// /ucg-routine-planner/, so the service worker and paths behave as they will live.
//   npm run build && npm run preview   ->  http://localhost:8139/ucg-routine-planner/
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../_site/', import.meta.url));
const BASE = '/ucg-routine-planner/';
const PORT = Number(process.env.PORT || 8139);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf',
  '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' || url.pathname === BASE.slice(0, -1)) {
    res.writeHead(302, { location: BASE + url.search });
    return res.end();
  }
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  let file = normalize(join(SITE, decodeURIComponent(url.pathname.slice(BASE.length))));
  if (!file.startsWith(normalize(SITE))) {
    res.writeHead(403);
    return res.end();
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  // Like GitHub Pages: short caching, so a rebuild shows up.
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`Serving _site at http://localhost:${PORT}${BASE}`));
