import { firestore } from '../firebase/firebase.js';
import { parseSnapshot } from '../firebase/firebase-utils.js';
import { getTrack } from './track.js';
import { currentPartySelector } from '../reducers/party.js';
import { queueItemsListSelector, queueTracksDataSelector } from '../reducers/queue.js';

export const RECEIVE_QUEUE = 'RECEIVE_QUEUE';

export const QUEUE_ORIGIN = 'QUEUE_ORIGIN';

let queueListener, queuePromise;
export const attachQueueListener = () => (dispatch, getState) => {
  return queuePromise || (queuePromise = new Promise((resolve) => {
    const currentParty = currentPartySelector(getState());
    queueListener = firestore.collection(`parties/${currentParty}/tracks`).orderBy('trackNumber').orderBy('memberOrderStamp').onSnapshot((queueSnapshot) => {
      const queueItems = parseSnapshot(queueSnapshot);
      dispatch(receiveQueue(queueItems));
      dispatch(getQueueTrackData());
      resolve();
    });
  }));
};
export const detachQueueListener = () => queueListener && (queueListener(), queuePromise = queueListener = null);

const getQueueTrackData = () => (dispatch, getState) => {
  const state = getState();
  const items = queueItemsListSelector(state);
  const trackData = queueTracksDataSelector(state);
  for (let id of items) {
    if (!trackData[id]) dispatch(getTrack(id, QUEUE_ORIGIN));
  }
};

const receiveQueue = (items) => {
  return {
    type: RECEIVE_QUEUE,
    items
  };
};