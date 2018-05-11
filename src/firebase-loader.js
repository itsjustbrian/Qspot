import { loadScripts } from './script-loader.js';

/**
 * Singleton firebase class
 */
class FirebaseLoader extends EventTarget {

  constructor() {
    super();
    this.db = null;
    this._loadedPromise = new Promise((resolve) => {
      this._resolveFirebaseLoaded = () => {
        resolve();
      };
    });
  }

  async load() {
    await loadScripts([
      'https://www.gstatic.com/firebasejs/4.12.0/firebase-app.js',
      'https://www.gstatic.com/firebasejs/4.12.0/firebase-auth.js',
      'https://www.gstatic.com/firebasejs/4.12.0/firebase-firestore.js'
    ], false);

    // Initialize Firebase
    const config = {
      apiKey: 'AIzaSyAabUU0gKPSk3wbgqdKFvcixl_NhKAJgj4',
      authDomain: 'queuespot-917af.firebaseapp.com',
      databaseURL: 'https://queuespot-917af.firebaseio.com',
      projectId: 'queuespot-917af',
    };
    firebase.initializeApp(config);
    this.db = firebase.firestore();
    this.attachUserListener();

    this._resolveFirebaseLoaded();
    return firebase;
  }

  attachUserListener() {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        user['claims'] = JSON.parse(b64DecodeUnicode(idToken.split('.')[1]));
      }
      this.dispatchEvent(new CustomEvent('auth-state-changed', { detail: user }));
    });
  }

  get loaded() {
    return this._loadedPromise;
  }
}

// Creates a singleton reference
export let firebaseLoader = new FirebaseLoader();

// Convenience function to get db
export function db() {
  if (window['firebase']) {
    return firebaseLoader.db;
  } else {
    throw new Error('The database could not be referenced because Firebase hasn\'t been loaded yet');
  }
}

// Convenience function to get user
export function currentUser() {
  if (window['firebase']) {
    return firebase.auth().currentUser;
  } else {
    throw new Error('The current user could not be referenced because Firebase hasn\'t been loaded yet');
  }
}

// base64 decode helper
function b64DecodeUnicode(str) {
  return decodeURIComponent(atob(str).split('').map(function (c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}