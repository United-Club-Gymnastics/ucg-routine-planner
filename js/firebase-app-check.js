// Firebase App Check, loaded only when it is turned on in js/firebase-config.js (appCheck.enabled).
// Development loads it from Google's CDN; the production build swaps in the same version from npm.
export { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js';
