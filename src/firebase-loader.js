import { loadScripts } from './script-loader.js';

/**
 * Singleton firebase class
 */
class FirebaseLoader {

  constructor() {
    this.db = null;
  }

  async load() {
    await loadScripts([
      'https://www.gstatic.com/firebasejs/4.9.0/firebase-app.js',
      'https://www.gstatic.com/firebasejs/4.9.0/firebase-auth.js',
      'https://www.gstatic.com/firebasejs/4.9.0/firebase-firestore.js'
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

    return Promise.resolve(firebase);
  }
}

// Creates a singleton reference
export let firebaseLoader = new FirebaseLoader();

// Convenience function to get db
export function db() {
  if (firebase) {
    return firebaseLoader.db;
  } else {
    throw new Error('The database could not be referenced because Firebase hasn\'t been loaded yet');
  }
}

// Convenience function to get user
export function currentUser() {
  if (firebase) {
    return firebase.auth().currentUser;
  } else {
    throw new Error('The current user could not be referenced because Firebase hasn\'t been loaded yet');
  }
}