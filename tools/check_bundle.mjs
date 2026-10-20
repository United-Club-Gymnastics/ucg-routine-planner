// Checks the vendored skill bundle (tools/source/bundle/) against tools/source/bundle.lock.json:
// the manifest's sha256 is the lock's, every file is listed in the manifest with the same sha256,
// the catalog versions agree, and the built js/data/catalog-*.js come from that catalog. So a hand
// edit under tools/source/bundle/, or a sync without a rebuild, fails CI.
// Run with: npm run check-bundle   (tests/bundle.test.mjs runs it too). Update with: npm run sync-skills
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUNDLE = join(ROOT, 'tools', 'source', 'bundle');
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
}

export async function bundleProblems() {
  const problems = [];
  const lock = json(join(ROOT, 'tools', 'source', 'bundle.lock.json'));
  const manifestPath = join(BUNDLE, 'manifest.json');
  if (sha256(manifestPath) !== lock.manifest_sha256) problems.push('manifest.json: sha256 differs from bundle.lock.json');
  const manifest = json(manifestPath);
  for (const k of ['schema_version', 'catalogs', 'sources']) {
    if (JSON.stringify(manifest[k]) !== JSON.stringify(lock[k])) problems.push(`manifest ${k} differs from bundle.lock.json`);
  }
  const present = new Set(walk(BUNDLE).map((p) => relative(BUNDLE, p).split(sep).join('/')));
  present.delete('manifest.json');
  for (const p of present) if (!manifest.files[p]) problems.push(`${p}: not in the manifest`);
  for (const [p, f] of Object.entries(manifest.files)) {
    if (!present.has(p)) problems.push(`${p}: missing`);
    else if (sha256(join(BUNDLE, p)) !== f.sha256) problems.push(`${p}: sha256 differs from the manifest (edited by hand? run npm run sync-skills)`);
  }
  for (const [disc, version] of Object.entries(lock.catalogs)) {
    const d = disc.toLowerCase();
    for (const name of [`catalog/catalog_${d}_public.json`, `catalog/aliases_${d}.json`]) {
      if (present.has(name) && json(join(BUNDLE, name)).version !== version) problems.push(`${name}: version is not ${version}`);
    }
    const { CATALOG } = await import(new URL(`../js/data/catalog-${d}.js`, import.meta.url));
    if (CATALOG.version !== version) problems.push(`js/data/catalog-${d}.js is catalog ${CATALOG.version}, the bundle has ${version}: run python tools/build_data.py`);
  }
  // Every ID this site ever shipped (tools/source/published-ids.json, append-only) still resolves,
  // is redirected, or was retired by ucg-code-of-points: saved routines hold these IDs.
  const published = json(join(ROOT, 'tools', 'source', 'published-ids.json'));
  const { retired, redirected } = retiredIds(manifest);
  for (const d of ['mag', 'wag']) {
    const keys = new Set(Object.keys(json(join(BUNDLE, 'catalog', `aliases_${d}.json`)).aliases));
    for (const id of published[d] || []) {
      if (!keys.has(id) && !retired[d].has(id) && !redirected[d].has(id)) problems.push(`published ${d.toUpperCase()} ID ${id} is neither an alias, a redirect nor retired`);
    }
  }
  return problems;
}

/** The IDs the bundle's UCG skill files and Masters vault tables retire or redirect, per discipline. */
export function retiredIds(manifest = json(join(BUNDLE, 'manifest.json'))) {
  const retired = { mag: new Set(), wag: new Set() }, redirected = { mag: new Set(), wag: new Set() };
  for (const [p, f] of Object.entries(manifest.files)) {
    if (f.schema !== 'skill.schema.json') continue;
    const d = json(join(BUNDLE, p));
    const disc = (d.discipline || '').toLowerCase();
    if (!retired[disc]) continue;
    for (const id of d.retired || []) retired[disc].add(id);
    for (const id of Object.keys(d.redirects || {})) redirected[disc].add(id);
  }
  const vaults = json(join(BUNDLE, 'skills', 'ucg-masters-vaults.json'));
  for (const disc of ['mag', 'wag']) for (const id of vaults[disc]?.retired || []) retired[disc].add(id);
  return { retired, redirected };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = await bundleProblems();
  if (problems.length) {
    console.error(`Vendored skill bundle check failed:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('tools/source/bundle/ matches bundle.lock.json');
}
