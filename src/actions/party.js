import { firestore, FieldValue } from '../firebase/firebase.js';
import { parseDoc, doBatchedAction } from '../firebase/firebase-utils.js';
import { API_HEAVY_DUTY_URL } from '../globals/globals.js';
import { userLoaded, getAuthIdToken } from './auth.js';
import { partyDataSelector, currentPartySelector } from '../reducers/party.js';
import { userIdSelector } from '../reducers/auth.js';
import { deletePartyCodeEntry } from './join.js';
import { fetchRetry } from '../util/fetch-utils.js';

export const RECEIVE_PARTY = 'RECEIVE_PARTY';

export const getCurrentParty = () => async (dispatch, getState) => {
  await userLoaded();
  const state = getState();
  const currentParty = currentPartySelector(state);
  if (!currentParty) return null;
  let partyData = partyDataSelector(state);
  if (partyData) return partyData;
  partyData = parseDoc(await firestore.collection('parties').doc(currentParty).get());
  dispatch(receiveParty(partyData));
  return partyData;
};

export const leaveParty = (batch) => (_, getState) => {
  const state = getState();
  const currentUserId = userIdSelector(state);
  const currentParty = currentPartySelector(state);

  return doBatchedAction(batch, (batch) => {
    batch.update(firestore.collection('users').doc(currentUserId), {
      currentParty: FieldValue.delete()
    });
    batch.update(firestore.collection('parties').doc(currentParty).collection('members').doc(currentUserId), {
      active: false
    });   
  });
};

export const endParty = () => async (dispatch, getState) => {
  const state = getState();
  const currentUserId = userIdSelector(state);
  const currentParty = currentPartySelector(state);
  await doBatchedAction(null, (batch) => {
    batch.update(firestore.collection('parties').doc(currentParty), {
      ended: true
    });
    batch.update(firestore.collection('users').doc(currentUserId), {
      currentParty: FieldValue.delete()
    });
  });
  await deletePartyCodeEntry(currentParty);
  // Cleanup of collections (members, tracks) must be done
  // with a server-side action
  // TODO: handle errors
  const authIdToken = await getAuthIdToken();
  return fetchRetry(`${API_HEAVY_DUTY_URL}/party/${currentParty}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authIdToken}` }
  });
};

/*let partyListener, partyPromise;
export const attachPartyStateListener = () => (dispatch, getState) => {
  const currentParty = currentPartySelector(getState());
  return partyPromise || (partyPromise = new Promise((resolve) => {
    partyListener = firestore.collection('parties').doc(currentParty).onSnapshot((snapshot) => {
      const party = parseDoc(snapshot);
      const partyState = party && party.partyState;
      dispatch(receiveParty());
      dispatch(partyStateChanged(partyState, LISTENER_ORIGIN));
      resolve();
    });
  }));
};
export const detachPartyListener = () => partyListener && (partyListener(), partyPromise = partyListener = null);*/

/**
 * Outline for host ending party
 * 
 * flag set on party doc, "ended: true" or something
 * Have all party members listen to party doc by default
 * When they get the ended signal, remove themselves from the party
 * In the background start cleaning up the party with a server side action
 * Anyone who wasn't listening when the party ended will find it doesn't exist anymore when they try to fetch it again
 * In this case, let them know it ended
 */

const receiveParty = (item) => {
  return {
    type: RECEIVE_PARTY,
    item
  };
};