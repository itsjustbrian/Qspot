import { API_URL } from '../globals/globals.js';
import { firestore, loadFirestore } from '../firebase/firebase.js';
import { clientTokenSelector, clientTokenListenerAttachedSelector } from '../reducers/tokens.js';

export const REQUEST_NEW_CLIENT_TOKEN = 'REQUEST_CLIENT_TOKEN';
export const RECEIVE_NEW_CLIENT_TOKEN = 'RECEIVE_CLIENT_TOKEN';
export const FAIL_NEW_CLIENT_TOKEN = 'FAIL_CLIENT_TOKEN';
export const RECEIVE_CLIENT_TOKEN_FROM_LISTENER = 'RECEIVE_CLIENT_TOKEN_FROM_LISTENER';

let newClientTokenPromise;
export const getClientToken = (forceNew) => async (dispatch, getState) => {
  await loadFirestore();
  if (newClientTokenPromise) {
    const { token } = await newClientTokenPromise;
    return token;
  }
  if (!clientTokenListenerAttachedSelector(getState())) {
    await attachClientTokenListener(dispatch); 
  }
  let token;
  if (!forceNew) {
    token = clientTokenSelector(getState());
    if (token) return token;
  }
  newClientTokenPromise = dispatch(fetchNewClientToken());
  token = await newClientTokenPromise;
  newClientTokenPromise = null;
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
  return !state.tokens.clientToken || state.tokens.clientToken.failure || state.tokens.clientToken.isFetching;
};

let clientTokenPromise;
const attachClientTokenListener = (dispatch) => {
  if (clientTokenPromise) return clientTokenPromise;
  clientTokenPromise = new Promise((resolve) => {
    firestore.collection('metadata').doc('spotify').onSnapshot((snapshot) => {
      const token = snapshot.get('accessToken');
      if (token) dispatch(receiveClientTokenFromListener(token));
      resolve();
    });
  });
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