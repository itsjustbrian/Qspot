import { firestore } from '../firebase/firebase.js';
import { parseSnapshot } from '../firebase/firebase-utils.js';
import { getTrack } from './track.js';
import { currentPartySelector } from '../reducers/party.js';

export const RECEIVE_QUEUE = 'RECEIVE_QUEUE';
export const RECEIVE_QUEUE_TRACK_DATA = 'RECEIVE_QUEUE_TRACK_DATA';

let queueListener, queuePromise;
export const attachQueueListener = () => (dispatch, getState) => {
  return queuePromise || (queuePromise = new Promise((resolve) => {
    const currentParty = currentPartySelector(getState());
    queueListener = firestore.collection(`parties/${currentParty}/tracks`).orderBy('trackNumber').orderBy('memberOrderStamp').onSnapshot((queueSnapshot) => {
      const queueItems = parseSnapshot(queueSnapshot);
      dispatch(receiveQueue(queueItems));
      for (let item of queueItems) {
        dispatch(getTrack(item.id));
      }
      resolve();
    });
  }));
};
export const detachQueueListener = () => queueListener && (queueListener(), queuePromise = null);

const receiveQueue = (items) => {
  return {
    type: RECEIVE_QUEUE,
    items
  };
};