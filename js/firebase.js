// The parts of Firebase the planner uses, in one place. store.js loads this module only
// when sign-in is configured, so nothing waits on it in local mode.
// In development these come straight from Google's CDN; the production build
// (tools/build_site.mjs) swaps the URLs for the same versions from npm and keeps only
// what's imported here.
export { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
export {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
export {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromCache,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  waitForPendingWrites,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
