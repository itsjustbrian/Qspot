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

const receiveParty = (item) => {
  return {
    type: RECEIVE_PARTY,
    item
  };
};