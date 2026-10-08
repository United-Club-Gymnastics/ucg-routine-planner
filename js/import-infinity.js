// Bringing routines over from the original UCG Infinity planner (Julia Sharpe's "UCG
// Infinity SV Sheets", jzsharpe.github.io/ucg-infinity-sv). Its athletes are in its own
// Firebase project, under each person's Google sign-in: the member signs in to that
// project once more (a second, separate Firebase app here), we read their athletes, and
// they come in as athletes with a UCG Infinity level. Nothing is changed in the old
// planner. Loaded only when someone opens the import.
import { normalizeEntry, newEntry } from './model.js';
import { INFINITY_VAULT_LIST } from './scoring/wag.js';

// The old planner's Firebase web config (public, as in its repository).
const OLD_CONFIG = {
  apiKey: 'AIzaSyCH6kZhkhyDMykfOWFk_ltyzXAnxMkGKkI',
  authDomain: 'ucg-infinity-sv-generator.firebaseapp.com',
  projectId: 'ucg-infinity-sv-generator',
  storageBucket: 'ucg-infinity-sv-generator.firebasestorage.app',
  messagingSenderId: '313388704446',
  appId: '1:313388704446:web:3223b5aba9385132fcf4ef',
};

// Its events, and ours.
const EVENTS = { bars: 'ub', beam: 'bb', floor: 'fx' };
const isBlank = (s) => !String(s?.name || '').trim() && !s?.letter;

/** The id an athlete brought over from the old planner carries (so it isn't brought twice). */
export const importKey = (old) => `infinity-sv:${old.id}`;

/**
 * One old-planner athlete as a planner athlete with a UCG Infinity level. Skills come over
 * as typed (the old planner had no skill list): name, difficulty and element group (the
 * same USAG group numbers), so start values are unchanged. `newId` makes ids.
 */
export function convertOldAthlete(old, newId) {
  const e = newEntry(newId(), 'wag', 'inf');
  for (const [from, ev] of Object.entries(EVENTS)) {
    // Very old records kept extra element-group skills apart (egSkills): they go at the end.
    const rows = [...(old.routines?.[from] || []), ...(old.egSkills?.[from] || [])].filter((s) => !isBlank(s));
    e.routines[ev] = rows.map((s) => ({ name: String(s.name || '').trim(), letter: s.letter || '', eg: s.eg ? String(s.eg) : '' }));
    if (old.eventBonus?.[from]) e.options[ev] = { ...e.options[ev], eventBonus: true };
  }
  // Vaults are named the same in both (the same reference table).
  e.vault = INFINITY_VAULT_LIST.some((v) => v.name === old.vault) ? old.vault : '';
  normalizeEntry(e);
  return {
    id: newId(),
    name: String(old.name || '').trim(),
    club: String(old.club || '').trim(),
    entries: [e],
    createdAt: old.createdAt || Date.now(),
    importedFrom: importKey(old),
  };
}

let oldApp = null;
let oldDb = null;

/**
 * The signed-in member's athletes in the old planner. Opens Google sign-in for the old
 * planner (`email` is suggested), reads, then signs out of it again.
 */
export async function readOldAthletes(email) {
  const fb = await import('./firebase.js');
  oldApp ||= fb.initializeApp(OLD_CONFIG, 'ucg-infinity-sv');
  const auth = fb.getAuth(oldApp);
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters(email ? { login_hint: email, prompt: 'select_account' } : { prompt: 'select_account' });
  const { user } = await fb.signInWithPopup(auth, provider);
  try {
    oldDb ||= fb.initializeFirestore(oldApp, { localCache: fb.memoryLocalCache() });
    const snap = await fb.getDocs(fb.collection(oldDb, 'users', user.uid, 'athletes'));
    return { email: user.email, athletes: snap.docs.map((d) => ({ ...d.data(), id: d.id })) };
  } finally {
    fb.signOut(auth).catch(() => {});
  }
}
