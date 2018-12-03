import { API_URL } from '../globals/globals.js';
import { parseDoc } from '../firebase/firebase-utils.js';
import { formatUrl } from '../util/fetch-utils.js';
import { loadAuth, firebaseAuth, loadFirestore, firestore } from '../firebase/firebase.js';
import { replaceLocationURL } from './app.js';
import { spotifyLoginSelector, userSelector } from '../reducers/auth.js';

export const SET_USER = 'SET_USER';
export const RECEIVE_USER_DATA = 'RECEIVE_USER_DATA';
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
      dispatch(attachUserDataListener());
    } else {
      dispatch(setUser());
      detachUserDataListener();
      resolveUserLoaded();
    }
  });
};

let userDataListener;
const attachUserDataListener = () => async (dispatch, getState) => {
  await loadFirestore();
  let currentUser = userSelector(getState());
  const userRef = firestore.collection('users').doc(currentUser.id);
  userDataListener = userRef.onSnapshot(async (doc) => {
    const userData = parseDoc(doc);
    const { displayName, email, photoURL } = currentUser;
    if (userData) dispatch(receiveUserData(userData));
    else userRef.set({ displayName, email, photoURL }, { merge: true });
    resolveUserLoaded();
  });
};
const detachUserDataListener = () => userDataListener && (userDataListener(), userDataListener = null);

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
    const { token } = await response.json();
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
  const { spotify, spotifyPremium } = idTokenResult.claims;
  const { uid: id, displayName, email, photoURL } = firebaseUser;
  return { id, displayName, email, photoURL, spotify, spotifyPremium };
};

const setUser = (user) => {
  return {
    type: SET_USER,
    user
  };
};

const receiveUserData = (userData) => {
  return {
    type: RECEIVE_USER_DATA,
    userData
  };
};

const failCreateSpotifyAccount = (error) => {
  return {
    type: FAIL_CREATE_SPOTIFY_ACCOUNT,
    error
  };
};