import { API_URL } from '../globals/globals.js';
import { firestore, loadFirestore, Timestamp } from '../firebase/firebase.js';
import { greaterThan } from '../firebase/firebase-utils.js';
import { spotifyClientTokenSelector, spotifyAccessTokenSelector } from '../reducers/auth.js';
import { getAuthIdToken } from './auth.js';

export const REQUEST_NEW_CLIENT_TOKEN = 'REQUEST_NEW_CLIENT_TOKEN';
export const RECEIVE_NEW_CLIENT_TOKEN = 'RECEIVE_NEW_CLIENT_TOKEN';
export const FAIL_NEW_CLIENT_TOKEN = 'FAIL_NEW_CLIENT_TOKEN';
export const RECEIVE_CLIENT_TOKEN_FROM_LISTENER = 'RECEIVE_CLIENT_TOKEN_FROM_LISTENER';

export const REQUEST_NEW_ACCESS_TOKEN = 'REQUEST_NEW_ACCESS_TOKEN';
export const RECEIVE_NEW_ACCESS_TOKEN = 'RECEIVE_NEW_ACCESS_TOKEN';
export const FAIL_NEW_ACCESS_TOKEN = 'FAIL_NEW_ACCESS_TOKEN';

export const ACCESS_TOKEN = 'ACCESS_TOKEN';
export const CLIENT_TOKEN = 'CLIENT_TOKEN';

let newClientTokenPromise;
export const getClientToken = (forceRefresh) => async (dispatch, getState) => {
  await loadFirestore();
  if (newClientTokenPromise) return newClientTokenPromise;
  await attachClientTokenListener(dispatch);
  let token = spotifyClientTokenSelector(getState()).value;
  if (!token || forceRefresh) {
    newClientTokenPromise = dispatch(fetchNewClientToken());
    token = await newClientTokenPromise;
    newClientTokenPromise = null;
  }
  return token;
};

const fetchNewClientToken = () => async (dispatch, getState) => {
  if (!shouldFetchNewClientToken(getState())) return;
  dispatch(requestNewClientToken());
  try {
    const response = await fetch(`${API_URL}/getSpotifyClientCredentials`);
    const { token } = await response.json();
    dispatch(receiveNewClientToken(token));
    return token;
  } catch (error) {
    dispatch(failNewClientToken());
  }
};

const shouldFetchNewClientToken = (state) => {
  const clientTokenRef = spotifyClientTokenSelector(state);
  return clientTokenRef.failure || !clientTokenRef.isFetching;
};

let clientTokenPromise;
const attachClientTokenListener = (dispatch) => {
  return clientTokenPromise || (clientTokenPromise = new Promise((resolve) => {
    firestore.collection('metadata').doc('spotify').onSnapshot((snapshot) => {
      const token = snapshot.get('accessToken');
      if (token) dispatch(receiveClientTokenFromListener(token));
      resolve();
    });
  }));
};

const requestNewClientToken = () => {
  return {
    type: REQUEST_NEW_CLIENT_TOKEN
  };
};

const receiveNewClientToken = (token) => {
  return {
    type: RECEIVE_NEW_CLIENT_TOKEN,
    token
  };
};

const failNewClientToken = () => {
  return {
    type: FAIL_NEW_CLIENT_TOKEN
  };
};

const receiveClientTokenFromListener = (token) => {
  return {
    type: RECEIVE_CLIENT_TOKEN_FROM_LISTENER,
    token
  };
};

let newAccessTokenPromise;
export const getAccessToken = (forceRefresh) => async (dispatch, getState) => {
  if (newAccessTokenPromise) return newAccessTokenPromise;
  
  const tokenRef = spotifyAccessTokenSelector(getState());
  let token = tokenRef.value;
  if (!token || forceRefresh || greaterThan(Timestamp.now(), tokenRef.expireTime)) {
    newAccessTokenPromise = dispatch(fetchNewAccessToken());
    token = await newAccessTokenPromise;
    newAccessTokenPromise = null;
  }
  return token;
};

export const fetchNewAccessToken = () => async (dispatch, getState) => {
  if (!shouldFetchNewAccessToken(getState())) return;
  dispatch(requestNewAccessToken());
  try {
    const authIdToken = await getAuthIdToken();
    const response = await fetch(`${API_URL}/refreshAccessToken`, {
      headers: {
        Authorization: `Bearer ${authIdToken}`
      }
    });
    const { token } = await response.json();
    dispatch(receiveNewAccessToken(token));
    return token;
  } catch (error) {
    dispatch(failNewAccessToken());
  }
};

const shouldFetchNewAccessToken = (state) => {
  const tokenRef = spotifyAccessTokenSelector(state);
  return tokenRef.failure || !tokenRef.isFetching;
};

const requestNewAccessToken = () => {
  return {
    type: REQUEST_NEW_ACCESS_TOKEN
  };
};

const receiveNewAccessToken = (token) => {
  return {
    type: RECEIVE_NEW_ACCESS_TOKEN,
    token
  };
};

const failNewAccessToken = () => {
  return {
    type: FAIL_NEW_ACCESS_TOKEN
  };
};

export const fetchWithToken = (type, url, options = {}) => async (dispatch) => {
  const tokenGetter = type === ACCESS_TOKEN ?
    (forceRefresh) => dispatch(getAccessToken(forceRefresh)) :
    (forceRefresh) => dispatch(getClientToken(forceRefresh));
  let token = await tokenGetter();
  options.headers = options.headers || {};
  options.headers.Authorization = `Bearer ${token}`;
  let response = await fetch(url, options);
  let responseJSON = await response.json();
  if (!response.ok && responseJSON.error && responseJSON.error.message === 'The access token expired') {
    token = await tokenGetter(true);
    options.headers.Authorization = `Bearer ${token}`;
    response = await fetch(url, options);
    responseJSON = await response.json();
  }
  return responseJSON;
};