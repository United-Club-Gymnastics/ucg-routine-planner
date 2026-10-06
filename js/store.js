// Persistence: Firebase (Google sign-in + Firestore) when configured,
// otherwise browser localStorage ("local mode"). Guests (not signed in) save nothing.
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
  db = fb.initializeFirestore(app, {});
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

export async function listAthletes() {
  if (!isConfigured) return readLocal();
  if (guest()) return [];
  const snap = await fb.getDocs(athletesCol());
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
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
  await fb.setDoc(fb.doc(athletesCol(), id), rest);
  return data;
}

export async function deleteAthlete(id) {
  if (!isConfigured) {
    writeLocal(readLocal().filter((a) => a.id !== id));
    return;
  }
  if (guest()) return;
  await fb.deleteDoc(fb.doc(athletesCol(), id));
}
