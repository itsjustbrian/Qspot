import { firestore, FieldValue } from '../firebase/firebase.js';
import { parseDoc, doBatchedAction } from '../firebase/firebase-utils.js';
import { userLoaded } from './auth.js';
import { partyDataSelector, currentPartySelector } from '../reducers/party.js';
import { userSelector } from '../reducers/auth.js';

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
  const currentUser = userSelector(state);
  const currentParty = currentPartySelector(state);

  return doBatchedAction(batch, () => {
    batch.update(firestore.collection('users').doc(currentUser.id), {
      currentParty: FieldValue.delete()
    });

    batch.update(firestore.collection('parties').doc(currentParty).collection('members').doc(currentUser.id), {
      active: false
    });   
  });
};

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