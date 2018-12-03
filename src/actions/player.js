import { firestore } from '../firebase/firebase.js';
import { doBatchedAction, parseDoc } from '../firebase/firebase-utils.js';
import { formatUrl, formatBody } from '../util/fetch-utils.js';
import { sequentialize } from '../util/promise-utils.js';
import { store } from '../store.js';
import { currentPartySelector, isHostSelector } from '../reducers/party.js';
import { spotifyAccountIsPremiumSelector } from '../reducers/auth.js';
import { qspotDeviceIsConnectedSelector, deviceIdSelector, playerActiveSelector } from '../reducers/player.js';

import { fetchWithToken, ACCESS_TOKEN } from './tokens.js';

export const PLAYER_CREATED = 'PLAYER_CREATED';
export const PLAYER_STATE_CHANGED = 'PLAYER_STATE_CHANGED';
export const PLAYER_READY = 'PLAYER_READY';
export const PLAYER_NOT_READY = 'PLAYER_NOT_READY';
export const PLAYER_CONNECTED = 'PLAYER_CONNECTED';
export const PLAYER_DISCONNECTED = 'PLAYER_DISCONNECTED';
export const PLAYER_ERROR = 'PLAYER_ERROR';
export const PAUSE_PLAYER = 'PAUSE_PLAYER';
export const RESUME_PLAYER = 'RESUME_PLAYER';
export const SEEK_PLAYER = 'SEEK_PLAYER';
export const SET_PLAYER_VOLUME = 'SET_VOLUME';
export const RECEIVE_NEXT_TRACK = 'RECEIVE_NEXT_TRACK';
export const GET_CONNECTED_DEVICES = 'GET_CONNECTED_DEVICES';

const LISTENER_ORIGIN = 'LISTENER_ORIGIN';

let setupPromise;
export const setupPlayer = () => (dispatch, getState) => {
  return setupPromise || (setupPromise = new Promise(async (resolve) => {
    const premium = spotifyAccountIsPremiumSelector(getState());
    if (premium) await dispatch(getConnectedDevices());
    const state = getState();
    const deviceConnected = qspotDeviceIsConnectedSelector(state);
    const currentUserIsHost = isHostSelector(state);
    if (!currentUserIsHost || deviceConnected) dispatch(attachPlaybackStateListener());
    else {
      dispatch(attachNextTrackListener());
      loadPlayer();
    }
    resolve();
  }));
};

const loadPlayer = async () => {
  const playerModule = await import('../player/player.js');
  playerModule.installPlayer(store);
};

let nextTrackListener;
export const attachNextTrackListener = () => async (dispatch, getState) => {
  return new Promise((resolve) => {
    const currentParty = currentPartySelector(getState());
    nextTrackListener = firestore.collection(`parties/${currentParty}/tracks`).orderBy('trackNumber').orderBy('memberOrderStamp').limit(1).onSnapshot((snapshot) => {
      const nextTrack = parseDoc(snapshot.docs[0]);
      dispatch(receiveNextTrack(nextTrack));
      resolve();
    });
  });
};
export const detachNextTrackListener = () => nextTrackListener && (nextTrackListener(), nextTrackListener = null);

const receiveNextTrack = (item) => {
  return {
    type: RECEIVE_NEXT_TRACK,
    item
  };
};

let playbackListener, playbackPromise;
export const attachPlaybackStateListener = () => (dispatch, getState) => {
  const currentParty = currentPartySelector(getState());
  return playbackPromise || (playbackPromise = new Promise((resolve) => {
    playbackListener = firestore.collection('parties').doc(currentParty).onSnapshot((snapshot) => {
      const party = parseDoc(snapshot);
      const playbackState = party && party.playbackState;
      dispatch(playbackStateChanged(playbackState, LISTENER_ORIGIN));
      resolve();
    });
  }));
};
export const detachPlaybackListener = () => playbackListener && (playbackListener(), playbackPromise = playbackListener = null);

const _playNextInQueue = sequentialize(async (dispatch, getState) => {
  const state = getState();
  const currentParty = currentPartySelector(state);
  const nextTrack = state.player.nextTrack;
  if (!nextTrack) return console.log('Nothing to play');

  await dispatch(playTrack(nextTrack.id));
  
  await doBatchedAction(null, async (batch) => {
    const member = parseDoc(await firestore.collection('parties').doc(currentParty).collection('members').doc(nextTrack.submitterId).get());
    const { numTracksPlayed } = member;
    batch.delete(firestore.collection('parties').doc(currentParty).collection('tracks').doc(nextTrack.id));
    // Only one user (the host) should be executing this, so avoiding transactions is a-okay
    batch.update(firestore.collection('parties').doc(currentParty).collection('members').doc(nextTrack.submitterId), {
      numTracksPlayed: numTracksPlayed + 1
    });
  });
});
export const playNextInQueue = () => (dispatch, getState) => {
  _playNextInQueue(dispatch, getState);
};

export const playTrack = (id, position) => async (dispatch, getState) => {
  const deviceId = deviceIdSelector(getState());
  return dispatch(fetchWithToken(ACCESS_TOKEN, formatUrl('https://api.spotify.com/v1/me/player/play', {
    device_id: deviceId
  }), {
    body: formatBody({
      uris: [`spotify:track:${id}`],
      position_ms: position
    }),
    method: 'PUT'
  }));
};

export const pausePlayer = () => async (dispatch, getState) => {
  const playerActive = playerActiveSelector(getState());
  if (playerActive) {
    dispatch({ type: PAUSE_PLAYER });
  } else {
    return dispatch(fetchWithToken(ACCESS_TOKEN, 'https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT'
    }));
  }
};

export const resumePlayer = () => async (dispatch, getState) => {
  const playerActive = playerActiveSelector(getState());
  if (playerActive) {
    dispatch({ type: RESUME_PLAYER });
  } else {
    dispatch(fetchWithToken(ACCESS_TOKEN), 'https://api.spotify.com/v1/me/player/play', {
      method: 'PUT'
    });
  }
};

export const getConnectedDevices = () => async (dispatch) => {
  let response = await dispatch(fetchWithToken(ACCESS_TOKEN, 'https://api.spotify.com/v1/me/player/devices'));
  const devices = response && response.devices;
  dispatch({ type: GET_CONNECTED_DEVICES, devices });
};

export const playbackStateChanged = (playbackState, origin) => {
  return {
    type: PLAYER_STATE_CHANGED,
    origin,
    playbackState
  };
};

export const playerError = (type, message) => {
  console.log('Player error', type, message);
  return {
    type: PLAYER_ERROR,
    message
  };
};