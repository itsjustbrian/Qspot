import { API_URL } from '../new/globals.js';
import { formatUrl } from '../util/url-formatter.js';
import { loadAuth, firebaseAuth, loadFirestore, firestore } from '../firebase/firebase.js';
import { replaceLocationURL } from './app.js';
import { spotifyLoginSelector } from '../reducers/auth.js';

export const SET_USER = 'SET_USER';

export const CREATE_SPOTIFY_ACCOUNT = 'CREATE_SPOTIFY_ACCOUNT';
export const FAIL_CREATE_SPOTIFY_ACCOUNT = 'FAIL_CREATE_SPOTIFY_ACCOUNT';

export const getUser = () => async (dispatch) => {
  await Promise.all([loadAuth().then(getRedirectResult), loadFirestore()]);
  const user = firebaseAuth.currentUser;
  user && dispatch(setUser(await getUserFromFirebaseUser(user)));

  dispatch(attachAuthListener());
};

export let resolveAuthorizing;
const spotifyAuthPromise = new Promise((resolve) => {
  resolveAuthorizing = () => {
    resolve();
  };
});

const getRedirectResult = () => {
  return Promise.all([firebaseAuth.getRedirectResult(), spotifyAuthPromise]);
};

let resolveUserLoaded;
const userLoadedPromise = new Promise((resolve) => {
  resolveUserLoaded = () => {
    resolve();
  };
});

export const userLoaded = () => {
  return userLoadedPromise;
};

const attachAuthListener = () => (dispatch) => {
  firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
      dispatch(attachUserDataListener(await getUserFromFirebaseUser(user)));
    } else {
      dispatch(setUser());
      detachUserDataListener();
      resolveUserLoaded();
    }
  });
};

let userDataListener;
const attachUserDataListener = (user) => async (dispatch) => {
  await loadFirestore();
  const userRef = firestore.collection('users').doc(user.id);
  userDataListener = userRef.onSnapshot(async (doc) => {
    const userData = doc.data();
    if (userData) dispatch(setUser({ ...userData, ...user }));
    else userRef.set({
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL
    });
    resolveUserLoaded();
  });
};
const detachUserDataListener = () => userDataListener && userDataListener();

export const getAuthIdToken = async (forceRefresh) => {
  await loadAuth();
  const user = firebaseAuth.currentUser;
  return user && user.getIdToken(forceRefresh);
};

export const signIn = () => async (dispatch) => {
  await loadAuth();
  const provider = new firebase.auth.GoogleAuthProvider();
  firebaseAuth.signInWithRedirect(provider);
};

export const signInToSpotify = () => (dispatch) => {
  window.location.href = `${API_URL}/spotifyAuthRedirect`;
};

export const createSpotifyAccount = () => async (dispatch, getState) => {
  const state = getState();
  dispatch(() => ({ type: CREATE_SPOTIFY_ACCOUNT }));
  dispatch(replaceLocationURL('/login'));

  const loginRef = spotifyLoginSelector(state);
  const code = loginRef.code;
  const verificationState = loginRef.verificationState;
  const error = loginRef.error;

  try {
    if (error || !code) throw error || 'No Code Provided';
    const response = await fetch(formatUrl(`${API_URL}/createSpotifyAccount`, {
      code,
      state: verificationState
    }), { credentials: 'include' });
    const { token, providers } = await response.json();
    await loadAuth();
    await firebaseAuth.signInWithCustomToken(token);
  } catch (error) {
    dispatch(failCreateSpotifyAccount(error));
  } finally {
    resolveAuthorizing();
  }
};

export const signOut = () => async (dispatch) => {
  await loadAuth();
  firebaseAuth.signOut();
};

const getUserFromFirebaseUser = async (firebaseUser) => {
  const idTokenResult = await firebaseUser.getIdTokenResult();
  firebaseUser['claims'] = idTokenResult.claims;
  return {
    id: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    spotifyAccountLinked: firebaseUser.claims.spotify,
    isSpotifyPremium: firebaseUser.claims.spotifyPremium
  };
};

const setUser = (user) => {
  return {
    type: SET_USER,
    user
  };
};

const failCreateSpotifyAccount = (error) => {
  return {
    type: FAIL_CREATE_SPOTIFY_ACCOUNT,
    error
  };
};