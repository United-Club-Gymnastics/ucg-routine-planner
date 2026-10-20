// Production build: bundles the app into _site/ for GitHub Pages.
//   npm run build        then preview with: npm run preview
// Development doesn't need this: `npm start` serves the source files as they are.
//
// - esbuild bundles js/app.js with code splitting: the startup code is one file, and
//   what's only needed later (Firebase, PDF export, the skill catalog, each discipline's
//   skill lists) comes in separate chunks loaded on demand.
// - The pinned CDN imports (Firebase from gstatic, pdf-lib from jsDelivr) are swapped for
//   the same versions from npm, so only the parts used are shipped and nothing at run time
//   depends on those CDNs.
// - Every file name carries a content hash, so browsers (and the service worker) can keep
//   them forever; index.html is the only file that changes in place.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');
const require = createRequire(import.meta.url);
const posix = (p) => p.split('\\').join('/');
const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);

// CDN URL -> npm module, same versions as package.json.
const CDN = [
  [/^https:\/\/www\.gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore|app-check)\.js$/, (m) => `firebase/${m[1]}`],
  [/^https:\/\/cdn\.jsdelivr\.net\/npm\/pdf-lib@1\.17\.1\/dist\/pdf-lib\.esm\.min\.js$/, () => 'pdf-lib'],
];
const cdnToNpm = {
  name: 'cdn-to-npm',
  setup(b) {
    b.onResolve({ filter: /^https:\/\// }, (args) => {
      for (const [re, to] of CDN) {
        const m = args.path.match(re);
        if (m) return { path: require.resolve(to(m), { paths: [ROOT] }) };
      }
      return { errors: [{ text: `Unpinned CDN import (add it to CDN in tools/build_site.mjs): ${args.path}` }] };
    });
  },
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const result = await build({
  absWorkingDir: ROOT,
  entryPoints: ['js/app.js'],
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022', // the planner already needs a current browser (findLast, ??=, :has)
  outdir: join(OUT, 'js'),
  entryNames: '[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  minify: true,
  sourcemap: true,
  metafile: true,
  legalComments: 'linked',
  plugins: [cdnToNpm],
  // The skill bundle's commit, stamped on entries whose values come from the skill lists (model.js).
  define: { 'globalThis.UCG_SKILLS_VERSION': JSON.stringify(JSON.parse(readFileSync(join(ROOT, 'tools', 'source', 'bundle.lock.json'), 'utf8')).copied_from.commit.slice(0, 12)) },
  logLevel: 'warning',
});

// Static files: assets (fonts, logos, worksheets) as they are; the stylesheet with a hash.
cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
// The brand typefaces (Greed Condensed, Suisse Intl) are licensed and kept out of git: when
// their files are in assets/fonts/, the stylesheet loads them; otherwise the planner uses
// Saira Condensed and Arial (the stylesheet's fallbacks).
const BRAND_FONTS = [
  ['Greed Condensed', 'GreedCondensed-Bold.woff2', '700', 'normal'],
  ['Suisse Intl', 'SuisseIntl-Regular.woff2', '400', 'normal'],
  ['Suisse Intl', 'SuisseIntl-RegularIt.woff2', '400', 'italic'],
  ['Suisse Intl', 'SuisseIntl-Bold.woff2', '600 700', 'normal'],
];
const brandFonts = BRAND_FONTS.filter(([, file]) => existsSync(join(ROOT, 'assets', 'fonts', file)));
const fontFaces = brandFonts
  .map(([family, file, weight, style]) => `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url('../assets/fonts/${file}') format('woff2')}`)
  .join('\n');
console.log(brandFonts.length ? `brand fonts: ${brandFonts.map((f) => f[1]).join(', ')}` : 'brand fonts: none in assets/fonts (using the fallbacks)');
const css = Buffer.concat([Buffer.from(fontFaces ? `${fontFaces}\n` : ''), readFileSync(join(ROOT, 'css', 'styles.css'))]);
const cssName = `css/styles-${hash(css)}.css`;
mkdirSync(join(OUT, 'css'), { recursive: true });
writeFileSync(join(OUT, cssName), css);

// The entry file, and the chunks it imports up front (preloaded so the browser fetches
// them in parallel instead of discovering them one by one).
const outputs = result.metafile.outputs;
const entry = Object.keys(outputs).find((f) => outputs[f].entryPoint === 'js/app.js');
const rel = (f) => posix(relative(OUT, join(ROOT, f)));
const preload = outputs[entry].imports.filter((i) => i.kind === 'import-statement').map((i) => rel(i.path));

// Content-Security-Policy (a meta tag: GitHub Pages can't set headers). The planner runs no
// third-party script except Google sign-in's (apis.google.com) and, with App Check on, reCAPTCHA.
// No inline script: the service worker is registered from the bundle (app.js).
const { appCheck, firebaseConfig } = await import(pathToFileURL(join(ROOT, 'js', 'firebase-config.js')).href);
const recaptcha = appCheck.enabled ? ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'] : [];
const CSP = [
  "default-src 'self'",
  `script-src 'self' https://apis.google.com ${recaptcha.join(' ')}`,
  "style-src 'self'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self'",
  `connect-src 'self' https://*.googleapis.com https://docs.google.com${appCheck.enabled ? ' https://content-firebaseappcheck.googleapis.com' : ''}`,
  // Google sign-in for this planner and for the UCG Infinity import (its own Firebase project).
  `frame-src https://${firebaseConfig.authDomain} https://ucg-infinity-sv-generator.firebaseapp.com ${appCheck.enabled ? 'https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/' : ''}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].map((d) => d.trim()).join('; ');
const securityMeta = [
  `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
  '<meta name="referrer" content="strict-origin-when-cross-origin" />',
];

const withSecurity = (page) => page.replace('<meta charset="utf-8" />', ['<meta charset="utf-8" />', ...securityMeta].join(`
    `));

// The privacy page: same stylesheet and policy as the planner.
let privacy = readFileSync(join(ROOT, 'privacy.html'), 'utf8').replace('href="css/styles.css?v=__BUILD__"', `href="${cssName}"`);
privacy = withSecurity(privacy);
if (privacy.includes('__BUILD__')) throw new Error('privacy.html still has development-only parts');
writeFileSync(join(OUT, 'privacy.html'), privacy);

let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
// The policy comes first in <head>, before anything it applies to.
html = withSecurity(html);
html = html.replace(/\s*<!-- Cache busting:[\s\S]*?<\/script>/, ''); // the development importmap
html = html.replace('href="css/styles.css?v=__BUILD__"', `href="${cssName}"`);
html = html.replace(
  '<script type="module">import "./js/app.js";</script>',
  `<script type="module" src="${rel(entry)}"></script>`
);
// Which build this is, for feedback reports: the commit (and its date).
let commit = process.env.GITHUB_SHA?.slice(0, 7);
try {
  commit ||= execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
} catch {}
const head = [
  `<meta name="planner-version" content="${commit || 'local'} · ${new Date().toISOString().slice(0, 10)}" />`,
  ...preload.map((f) => `<link rel="modulepreload" href="${f}" />`),
  // Sign-in and the database talk to these as soon as Firebase starts.
  '<link rel="preconnect" href="https://firestore.googleapis.com" crossorigin />',
  '<link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossorigin />',
];
html = html.replace('</head>', `    ${head.join('\n    ')}\n  </head>`);
if (html.includes('__BUILD__') || html.includes('importmap')) throw new Error('index.html still has development-only parts');
const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>/);
if (inline) throw new Error(`index.html has an inline script, which the Content-Security-Policy blocks: ${inline[0]}`);
writeFileSync(join(OUT, 'index.html'), html);

// Report: what loads at startup vs on demand.
const size = (f) => statSync(join(ROOT, f)).size;
const kb = (n) => `${Math.round(n / 1024)} KB`;
const startup = [entry, ...outputs[entry].imports.filter((i) => i.kind === 'import-statement').map((i) => i.path)];
const lazy = Object.keys(outputs).filter((f) => f.endsWith('.js') && !startup.includes(f));
console.log(`startup JS: ${kb(startup.reduce((t, f) => t + size(f), 0))} in ${startup.length} files`);
for (const f of lazy) console.log(`  on demand: ${posix(relative(OUT, join(ROOT, f)))} ${kb(size(f))}`);

// Every file of this build, for the service worker's precache list.
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!/\.(map|LEGAL\.txt)$/.test(name)) files.push(posix(relative(OUT, p)));
  }
};
walk(OUT);
files.sort();
writeFileSync(join(OUT, 'build-files.json'), JSON.stringify(files, null, 1));
if (!existsSync(join(OUT, 'index.html'))) throw new Error('no index.html');

// Service worker: this build's version and every file to keep on the device.
const version = hash(Buffer.concat(files.map((f) => readFileSync(join(OUT, f)))));
const sw = readFileSync(join(ROOT, 'tools', 'sw-template.js'), 'utf8')
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace('__FILES__', JSON.stringify(files.filter((f) => f !== 'build-files.json')));
writeFileSync(join(OUT, 'sw.js'), sw);
console.log(`service worker: version ${version}, ${files.length - 1} files`);
