import { firestore } from '../firebase/firebase.js';
import { parseSnapshot } from '../firebase/firebase-utils.js';
import { currentPartySelector } from '../reducers/party.js';
import { userSelector } from '../reducers/auth.js';
import { myTracksItemsListSelector, myTracksDataSelector } from '../reducers/my-tracks.js';
import { getTrack } from './track.js';
import { attachPartyMembersListener } from './members.js';
import { getCurrentParty } from './party.js';

export const RECEIVE_MY_TRACKS = 'RECEIVE_MY_TRACKS';

export const MY_TRACKS_ORIGIN = 'MY_TRACKS_ORIGIN';

export const loadMyTracks = () => async (dispatch, getState) => {
  await dispatch(getCurrentParty());
  const state = getState();
  if (!userSelector(state) || !currentPartySelector(state)) return;
  dispatch(attachMyTracksListener());
  dispatch(attachPartyMembersListener());
};

let tracksListener, tracksPromise;
const attachMyTracksListener = () => (dispatch, getState) => {
  return tracksPromise || (tracksPromise = new Promise((resolve) => {
    const state = getState();
    const currentParty = currentPartySelector(state);
    const currentUser = userSelector(state);
    tracksListener = firestore.collection(`parties/${currentParty}/tracks`).where('submitterId', '==', currentUser.id).orderBy('timestamp').onSnapshot((snapshot) => {
      const items = parseSnapshot(snapshot);
      dispatch(receiveMyTracks(items));
      dispatch(getMyTracksData());
      resolve();
    });
  }));
};
const detachMyTracksListener = () => tracksListener && (tracksListener(), tracksPromise = tracksListener = null);

const getMyTracksData = () => (dispatch, getState) => {
  const state = getState();
  const items = myTracksItemsListSelector(state);
  const trackData = myTracksDataSelector(state);
  for (let id of items) {
    if (!trackData[id]) dispatch(getTrack(id, MY_TRACKS_ORIGIN));
  }
};

const receiveMyTracks = (items) => {
  return {
    type: RECEIVE_MY_TRACKS,
    items
  };
};