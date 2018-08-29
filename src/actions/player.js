import { firestore } from '../firebase/firebase.js';
import { doBatchedAction, parseDoc } from '../firebase/firebase-utils.js';
import { formatUrl } from '../util/url-formatter.js';
import { noParallel } from '../util/no-parallel.js';
import { store } from '../store.js';
import { currentPartySelector, isHostSelector } from '../reducers/party.js';
import { isListeningToPartySelector } from '../reducers/auth.js';
import { qspotDeviceIsConnectedSelector } from '../reducers/player.js';
import { getAccessToken } from './tokens.js';

export const PLAYER_CREATED = 'PLAYER_CREATED';
export const PLAYER_STATE_CHANGED = 'PLAYER_STATE_CHANGED';
export const PLAYER_READY = 'PLAYER_READY';
export const PLAYER_NOT_READY = 'PLAYER_NOT_READY';
export const PLAYER_DISCONNECTED = 'PLAYER_DISCONNECTED';
export const PLAYER_ERROR = 'PLAYER_ERROR';
export const PAUSE_PLAYER = 'PAUSE_PLAYER';
export const RESUME_PLAYER = 'RESUME_PLAYER';
export const SEEK_PLAYER = 'SEEK_PLAYER';
export const SET_PLAYER_VOLUME = 'SET_VOLUME';
export const RECEIVE_NEXT_TRACK = 'RECEIVE_NEXT_TRACK';
export const GET_CONNECTED_DEVICES = 'GET_CONNECTED_DEVICES';

const LISTENER_ORIGIN = 'LISTENER_ORIGIN';

export const setupPlayer = () => async (dispatch, getState) => {
  const state = getState();
  const currentUserIsHost = isHostSelector(state);
  const listeningToParty = isListeningToPartySelector(state);
  let deviceConnected = false;
  if (currentUserIsHost || listeningToParty) {
    await dispatch(getConnectedDevices());
    deviceConnected = qspotDeviceIsConnectedSelector(getState());
  }

  if (!currentUserIsHost || deviceConnected) {
    dispatch(attachPlaybackStateListener());
  }

  if (currentUserIsHost && !deviceConnected) {
    dispatch(attachNextTrackListener());
  }

  if ((currentUserIsHost || listeningToParty) && !deviceConnected) {
    const playerModule = await import('../player/player.js');
    playerModule.installPlayer(store);
  }
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
    });
  }));
};
export const detachplaybackListener = () => playbackListener && (playbackListener(), playbackPromise = playbackListener = null);

const _playNextInQueue = async (dispatch, getState) => {
  const state = getState();
  const currentParty = currentPartySelector(state);
  const deviceId = state.player.deviceId;
  const nextTrack = state.player.nextTrack;
  if (!nextTrack) return console.log('Nothing to play');

  const token = await dispatch(getAccessToken());
  await fetch(formatUrl('https://api.spotify.com/v1/me/player/play', {
    device_id: deviceId
  }), {
    body: JSON.stringify({ uris: [`spotify:track:${nextTrack.id}`] }),
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  await doBatchedAction(null, async (batch) => {
    const member = parseDoc(await firestore.collection('parties').doc(currentParty).collection('members').doc(nextTrack.submitterId).get());
    const { numTracksPlayed } = member;
    batch.delete(firestore.collection('parties').doc(currentParty).collection('tracks').doc(nextTrack.id));
    // Only one user (the host) should be executing this, so avoiding transactions is a-okay
    batch.update(firestore.collection('parties').doc(currentParty).collection('members').doc(nextTrack.submitterId), {
      numTracksPlayed: numTracksPlayed + 1
    });
  });
};
const __playNextInQueue = noParallel(_playNextInQueue);
export const playNextInQueue = () => (dispatch, getState) => {
  __playNextInQueue(dispatch, getState);
};

export const getConnectedDevices = () => async (dispatch) => {
  const token = await dispatch(getAccessToken());
  let response = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` }
  });
  response = await response.json();
  const devices = response && response.devices;
  dispatch({ type: GET_CONNECTED_DEVICES, devices });
};

export const listenToParty = () => (dispatch, getState) => {

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

export const pausePlayer = () => ({ type: PAUSE_PLAYER });
export const resumePlayer = () => ({ type: RESUME_PLAYER });