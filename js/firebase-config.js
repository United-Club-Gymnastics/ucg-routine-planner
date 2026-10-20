// Firebase web app config (Firebase console → Project settings → General → Your apps).
// These values are safe to publish; access is protected by firestore.rules.
// Only export the config object here — js/store.js loads the Firebase SDK itself.
// Project ucg-routine-planners lives in the unitedclubgymnastics.org Google Cloud organization.
export const firebaseConfig = {
  apiKey: 'AIzaSyDZx6w4Z3pIHf-TImxWulX-GmMP4L4Ej54',
  authDomain: 'ucg-routine-planners.firebaseapp.com',
  projectId: 'ucg-routine-planners',
  storageBucket: 'ucg-routine-planners.firebasestorage.app',
  messagingSenderId: '3643978278',
  appId: '1:3643978278:web:1daa7e997de0a115daece7',
};

// Firebase App Check (reCAPTCHA Enterprise): off until it is set up in the Firebase console.
// To turn it on: register the web app under App Check with a reCAPTCHA Enterprise key, put the
// key here, set enabled: true, deploy, and only then enforce App Check for Firestore in the console.
export const appCheck = { enabled: false, siteKey: '' };
