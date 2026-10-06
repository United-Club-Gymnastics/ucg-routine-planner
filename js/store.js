// Persistence: Firebase (Google sign-in + Firestore) when configured,
// otherwise browser localStorage ("local mode"). Guests (not signed in) save nothing.
// Firestore keeps a copy on the device: athletes load from it straight away, edits
// save to it even with no signal and sync when the connection is back, and changes
// made on another device arrive live (watchAthletes).
import { firebaseConfig } from './firebase-config.js';

// Add ?local to the address to try the app without signing in (saves in this browser only).
const forceLocal = new URLSearchParams(location.search).has('local');
export const isConfigured = !forceLocal && !String(firebaseConfig.apiKey || '').startsWith('YOUR_');

let auth, db, fb;

export async function init(onUserChange) {
  if (!isConfigured) {
    onUserChange({ uid: 'local', displayName: 'Local mode', local: true });
    return;
  }
  fb = await import('./firebase.js');
  const app = fb.initializeApp(firebaseConfig);
  auth = fb.getAuth(app);
  try {
    // Offline copy shared by every open tab of the planner.
    db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) });
  } catch (e) {
    console.warn('Offline storage unavailable here (e.g. a private window); using memory only.', e);
    db = fb.initializeFirestore(app, { localCache: fb.memoryLocalCache() });
  }
  fb.onAuthStateChanged(auth, (user) => onUserChange(user));
}

export async function signIn() {
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await fb.signInWithPopup(auth, provider);
}

export async function signOut() {
  if (auth) await fb.signOut(auth);
}

// ---- Athletes -------------------------------------------------------------

const LOCAL_KEY = 'rp-athletes';
const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
};
const writeLocal = (list) => localStorage.setItem(LOCAL_KEY, JSON.stringify(list));

// Athletes for the combined planner (each holds its levels as entries). The MAG-only
// planner's data is in 'magAthletes' and is left alone.
const athletesCol = () => fb.collection(db, 'users', auth.currentUser.uid, 'athletes');

// Trying the planner without signing in: nothing is read or saved.
const guest = () => isConfigured && !auth?.currentUser;

export function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

const fromDocs = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));

// The device's copy first (instant, works offline); the server only if there's none yet.
// watchAthletes then brings in anything newer.
export async function listAthletes() {
  if (!isConfigured) return readLocal();
  if (guest()) return [];
  try {
    const cached = await fb.getDocsFromCache(athletesCol());
    if (!cached.empty) return fromDocs(cached);
  } catch {
    // nothing cached yet
  }
  return fromDocs(await fb.getDocs(athletesCol()));
}

/**
 * Live changes to the signed-in user's athletes, from other devices or tabs:
 * onChange([{ type: 'added' | 'modified' | 'removed', athlete }]). Changes this
 * device made itself aren't reported. Returns a function that stops watching.
 */
export function watchAthletes(onChange) {
  if (!isConfigured || guest()) return () => {};
  return fb.onSnapshot(
    athletesCol(),
    (snap) => {
      const changes = snap
        .docChanges()
        .filter((c) => !c.doc.metadata.hasPendingWrites)
        .map((c) => ({ type: c.type, athlete: { ...c.doc.data(), id: c.doc.id } }));
      if (changes.length) onChange(changes);
    },
    (err) => console.warn('Live updates stopped:', err)
  );
}

export async function saveAthlete(athlete) {
  const data = { ...athlete, updatedAt: Date.now() };
  if (!isConfigured) {
    const list = readLocal().filter((a) => a.id !== data.id);
    writeLocal([...list, data]);
    return data;
  }
  if (guest()) return data;
  const { id, ...rest } = data;
  // The write lands in the device's copy at once; the promise settles when the server has it.
  // With no signal that can take a while, so after a moment report it as saved on the device.
  const synced = fb.setDoc(fb.doc(athletesCol(), id), rest);
  const quick = await Promise.race([synced.then(() => true), new Promise((r) => setTimeout(() => r(false), 2500))]);
  return quick ? data : { ...data, pending: synced };
}

export async function deleteAthlete(id) {
  if (!isConfigured) {
    writeLocal(readLocal().filter((a) => a.id !== id));
    return;
  }
  if (guest()) return;
  await fb.deleteDoc(fb.doc(athletesCol(), id));
}
