// firestore.rules against the Firestore emulator. Needs the Firebase CLI and Java:
//   npm run test:rules      (firebase emulators:exec starts the emulator and runs this file)
// Under plain `npm test` there's no emulator (FIRESTORE_EMULATOR_HOST unset): these tests skip.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const host = process.env.FIRESTORE_EMULATOR_HOST;
const skip = host ? false : 'no Firestore emulator (run npm run test:rules)';

let env, rut, fs;
before(async () => {
  if (skip) return;
  rut = await import('@firebase/rules-unit-testing');
  fs = await import('firebase/firestore');
  const [hostname, port] = host.split(':');
  env = await rut.initializeTestEnvironment({
    projectId: 'demo-ucg-routine-planner',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: hostname, port: Number(port) },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => env?.clearFirestore());

const db = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const athlete = (extra = {}) => ({
  name: 'Julia', club: 'UCG', createdAt: 1760000000000, updatedAt: 1760000000000, schemaVersion: 2,
  entries: [{ id: 'e1', disc: 'wag', level: 'inf', vault: 'INF-012', routines: {}, passes: {}, options: {} }],
  ...extra,
});
const ref = (uid, owner, col = 'athletes', id = 'a1') => fs.doc(db(uid), 'users', owner, col, id);

test('own athletes: create, read, update, delete', { skip }, async () => {
  await rut.assertSucceeds(fs.setDoc(ref('alice', 'alice'), athlete()));
  await rut.assertSucceeds(fs.getDoc(ref('alice', 'alice')));
  await rut.assertSucceeds(fs.setDoc(ref('alice', 'alice'), athlete({ name: 'Julia S', importedFrom: 'infinity-sv:old-1' })));
  await rut.assertSucceeds(fs.deleteDoc(ref('alice', 'alice')));
});

test('older saved shapes still save (no schemaVersion, no club, no entries)', { skip }, async () => {
  await rut.assertSucceeds(fs.setDoc(ref('alice', 'alice'), { name: '', club: '', entries: [], createdAt: 1, updatedAt: 2 }));
  await rut.assertSucceeds(fs.setDoc(ref('alice', 'alice', 'athletes', 'a2'), { name: 'Old', updatedAt: 2 }));
});

test("another user's athletes: no read, no write", { skip }, async () => {
  await env.withSecurityRulesDisabled((ctx) => fs.setDoc(fs.doc(ctx.firestore(), 'users', 'alice', 'athletes', 'a1'), athlete()));
  await rut.assertFails(fs.getDoc(ref('mallory', 'alice')));
  await rut.assertFails(fs.setDoc(ref('mallory', 'alice'), athlete()));
  await rut.assertFails(fs.deleteDoc(ref('mallory', 'alice')));
});

test('not signed in: no read, no write', { skip }, async () => {
  await rut.assertFails(fs.getDoc(ref(null, 'alice')));
  await rut.assertFails(fs.setDoc(ref(null, 'alice'), athlete()));
});

test('oversized or unexpected athletes are refused', { skip }, async () => {
  await rut.assertFails(fs.setDoc(ref('alice', 'alice'), athlete({ name: 'x'.repeat(201) })));
  await rut.assertFails(fs.setDoc(ref('alice', 'alice'), athlete({ club: 'x'.repeat(201) })));
  await rut.assertFails(fs.setDoc(ref('alice', 'alice'), athlete({ entries: Array.from({ length: 41 }, (_, i) => ({ id: `e${i}` })) })));
  await rut.assertFails(fs.setDoc(ref('alice', 'alice'), athlete({ blob: 'x' })));
  await rut.assertFails(fs.setDoc(ref('alice', 'alice'), athlete({ name: 42 })));
  await rut.assertFails(fs.setDoc(ref('alice', 'alice', 'athletes', 'x'.repeat(101)), athlete()));
});

test('the MAG-only planner: own magAthletes allowed, others denied, other collections denied', { skip }, async () => {
  const mag = { name: 'Sam', club: 'UCG', level: 'int', routines: {}, options: {}, vault: '', createdAt: 1, updatedAt: 2 };
  await rut.assertSucceeds(fs.setDoc(ref('alice', 'alice', 'magAthletes'), mag));
  await rut.assertSucceeds(fs.deleteDoc(ref('alice', 'alice', 'magAthletes')));
  await rut.assertFails(fs.setDoc(ref('mallory', 'alice', 'magAthletes'), mag));
  await rut.assertFails(fs.setDoc(ref('alice', 'alice', 'magAthletes'), { ...mag, name: 'x'.repeat(201) }));
  await rut.assertFails(fs.setDoc(ref('alice', 'alice', 'other'), { a: 1 }));
  await rut.assertFails(fs.setDoc(fs.doc(db('alice'), 'feedback', 'f1'), { a: 1 }));
});

test('what the planner actually writes passes: every saved-shape fixture and an imported athlete', { skip }, async () => {
  const { readdirSync } = await import('node:fs');
  const { athleteDoc, migrateAthlete } = await import('../js/athlete-doc.js');
  const { convertOldAthlete } = await import('../js/import-infinity.js');
  const dir = new URL('./fixtures/athletes/', import.meta.url);
  // As store.saveAthlete writes it: no id, an updatedAt.
  const written = (a) => {
    const { id, _about, ...doc } = { ...athleteDoc(a), updatedAt: Date.now() };
    return doc;
  };
  let n = 0;
  for (const file of readdirSync(dir)) {
    const a = migrateAthlete(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
    await rut.assertSucceeds(fs.setDoc(ref('alice', 'alice', 'athletes', `f${n++}`), written(a)));
  }
  let i = 0;
  const imported = convertOldAthlete({ id: 'old-1', name: 'Julia', club: 'UCG', vault: 'Yamashita - 1/2 Off', routines: {} }, () => `id-${i++}`);
  await rut.assertSucceeds(fs.setDoc(ref('alice', 'alice', 'athletes', 'imp'), written(imported)));
});

test('listing athletes (how the planner loads them): own list allowed, another user\'s denied', { skip }, async () => {
  const list = (uid, owner, col = 'athletes') => fs.getDocs(fs.collection(db(uid), 'users', owner, col));
  await rut.assertSucceeds(list('alice', 'alice'));
  await rut.assertSucceeds(list('alice', 'alice', 'magAthletes'));
  await rut.assertFails(list('mallory', 'alice'));
  await rut.assertFails(list(null, 'alice'));
  await rut.assertFails(fs.getDocs(fs.collection(db('alice'), 'users')));
});
