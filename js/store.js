// Persistence: Firebase (Google sign-in + Firestore) when configured,
// otherwise browser localStorage ("local mode"). Guests (not signed in) save nothing.
// Firestore keeps a copy on the device: athletes load from it straight away, edits
// save to it even with no signal and sync when the connection is back, and changes
// made on another device arrive live (watchAthletes).
import { appCheck, firebaseConfig } from './firebase-config.js';
import { athleteDoc } from './athlete-doc.js';

// Add ?local to the address to try the app without signing in (saves in this browser only).
// A copy published for testing says so in its page instead: <meta name="planner-mode" content="local">.
const forceLocal = new URLSearchParams(location.search).has('local') || !!document.querySelector('meta[name="planner-mode"][content="local"]');
export const isConfigured = !forceLocal && !String(firebaseConfig.apiKey || '').startsWith('YOUR_');

let auth, db, fb;

export async function init(onUserChange) {
  if (!isConfigured) {
    onUserChange({ uid: 'local', displayName: 'Local mode', local: true });
    return;
  }
  fb = await import('./firebase.js');
  const app = fb.initializeApp(firebaseConfig);
  if (appCheck.enabled && appCheck.siteKey) {
    const ac = await import('./firebase-app-check.js');
    ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(appCheck.siteKey), isTokenAutoRefreshEnabled: true });
  }
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

// Signing out also removes the device's copy of the athletes (a shared club computer keeps
// nothing readable), then reloads: the database can't be used again once it is shut down.
// Edits not yet on the server would be lost with it: `okToLose()` asks first.
export async function signOut(okToLose = () => true) {
  if (!auth) return;
  const synced = await Promise.race([fb.waitForPendingWrites(db).then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), 4000))]);
  if (!synced && !okToLose()) return;
  await fb.signOut(auth);
  await forgetDevice();
  location.reload();
}

async function forgetDevice() {
  try {
    await fb.terminate(db);
    await fb.clearIndexedDbPersistence(db);
  } catch (e) {
    // Another open tab of the planner still holds it: that tab clears it when it signs out.
    console.warn('Could not clear the offline copy:', e);
  }
  try {
    localStorage.removeItem('rp-athlete'); // the last athlete opened
  } catch {}
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
  // Every level, the ones this version doesn't show too (athlete-doc.js): saving never drops one.
  const data = { ...athleteDoc(athlete), updatedAt: Date.now() };
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

// ---- Your data: export and delete -------------------------------------------------

// The MAG-only planner (ucg-mag-planner) keeps its athletes in the same account, here.
const magCol = () => fb.collection(db, 'users', auth.currentUser.uid, 'magAthletes');

/** Everything saved for the signed-in user (or in local mode, this browser), for a download. */
export async function exportData() {
  const about = { exported: new Date().toISOString(), app: 'UCG Routine Planner', site: location.origin };
  if (!isConfigured) return { ...about, account: 'local mode (this browser only)', athletes: readLocal() };
  if (guest()) return { ...about, athletes: [] };
  // From the server, so nothing saved from another device is missed.
  const [athletes, mag] = await Promise.all([fb.getDocsFromServer(athletesCol()), fb.getDocsFromServer(magCol())]);
  const u = auth.currentUser;
  return { ...about, account: { uid: u.uid, email: u.email, name: u.displayName }, athletes: fromDocs(athletes), magPlannerAthletes: fromDocs(mag) };
}

/**
 * Delete every athlete (this planner's and the MAG planner's), then the sign-in itself. Needs a
 * connection. Google may ask the person to sign in again first (a recent sign-in is required
 * to delete an account). Reloads when done.
 */
export async function deleteAllData() {
  if (!isConfigured) {
    localStorage.removeItem(LOCAL_KEY);
    location.reload();
    return;
  }
  if (guest()) return;
  for (const col of [athletesCol(), magCol()]) {
    const snap = await fb.getDocsFromServer(col);
    await Promise.all(snap.docs.map((d) => fb.deleteDoc(d.ref)));
  }
  const user = auth.currentUser;
  try {
    await fb.deleteUser(user);
  } catch (e) {
    if (e?.code !== 'auth/requires-recent-login') throw e;
    await fb.reauthenticateWithPopup(user, new fb.GoogleAuthProvider());
    await fb.deleteUser(user);
  }
  await forgetDevice();
  location.reload();
}
