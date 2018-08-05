import { loadAuth, firebaseAuth, loadFirestore, firestore } from '../firebase/firebase.js';

export const SET_USER = 'SET_USER';
export const SET_USER_DATA = 'SET_USER_DATA';

export const attachAuthListener = () => async (dispatch) => {
  await loadAuth();
  firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
      const idTokenResult = await user.getIdTokenResult();
      user['claims'] = idTokenResult.claims;
      dispatch(setUser(getUserFromFirebaseUser(user)));
      // save user to db here
    } else {
      dispatch(setUser());
    }
  });
};

export const attachUserDataListener = (uid) => async (dispatch) => {
  await loadFirestore();
  firestore.collection('users').doc(uid).onSnapshot((doc) => {
    const userData = doc.data();
    if (userData) dispatch(setUserData(userData));
  });
};

export const signIn = () => async (dispatch) => {
  await loadAuth();
  const provider = new firebase.auth.GoogleAuthProvider();
  firebaseAuth.signInWithRedirect(provider);
};

export const signOut = () => async (dispatch) => {
  await loadAuth();
  firebaseAuth.signOut();
};

const getUserFromFirebaseUser = (firebaseUser) => {
  return {
    id: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    imageUrl: firebaseUser.photoURL,
    spotifyAccount: firebaseUser.claims.spotify,
    spotifyPremiumAccount: firebaseUser.claims.spotifyPremium
  };
};

const setUser = (user) => {
  return {
    type: SET_USER,
    user
  };
};

const setUserData = (userData) => {
  return {
    type: SET_USER_DATA,
    userData
  };
};