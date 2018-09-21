import { loadScripts } from '../util/script-loader.js';
import { config } from './firebase-config.js';

const FIREBASE_VERSION = '5.3.1';

export let firebase;
export let firestore;
export let firebaseAuth;
export let Timestamp;
export let FieldValue;

let loadAppPromise;
const loadApp = () => {
  return loadAppPromise || (loadAppPromise = (async () => {
    await loadScripts([`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`], true);

    firebase = window['firebase'];
    firebase.initializeApp(config);
  })());
};

let loadAuthPromise;
export const loadAuth = () => {
  return loadAuthPromise || (loadAuthPromise = (async () => {
    await loadApp();
    await loadScripts([`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`], true);

    firebaseAuth = firebase.auth();
  })());
};

let loadFirestorePromise;
export const loadFirestore = () => {
  return loadFirestorePromise || (loadFirestorePromise = (async () => {
    await loadApp();
    await loadScripts([`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`], true);

    firestore = firebase.firestore();
    Timestamp = firebase.firestore.Timestamp;
    FieldValue = firebase.firestore.FieldValue;
    const settings = { timestampsInSnapshots: true };
    firestore.settings(settings);
  })());
};