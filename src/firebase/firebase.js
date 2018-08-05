import { loadScripts } from '../util/script-loader.js';
import { config } from './firebase-config.js';

const FIREBASE_VERSION = '4.13.0';

// Singleton Firebase reference
export let firebase = null;

// Reference to firestore db
export let firestore = null;

// Reference to auth
export let firebaseAuth = null;

let loadAppPromise, loadAuthPromise, loadFirestorePromise;

const loadApp = () => {
  if (!loadAppPromise) {
    loadAppPromise = (async () => {
      await loadScripts([`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`], true);

      // Initialize Firebase
      firebase = window['firebase'];
      firebase.initializeApp(config);
    })();
  }
  return loadAppPromise;
};

export const loadAuth = () => {
  if (!loadAuthPromise) {
    loadAuthPromise = (async () => {
      await loadApp();
      await loadScripts([`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`], true);

      firebaseAuth = firebase.auth();
    })();
  }
  return loadAuthPromise;
};

export const loadFirestore = () => {
  if (!loadFirestorePromise) {
    loadFirestorePromise = (async () => {
      await loadApp();
      await loadScripts([`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`], true);

      firestore = firebase.firestore();
      const settings = { timestampsInSnapshots: true };
      firestore.settings(settings);
    })();
  }
  return loadFirestorePromise;
};