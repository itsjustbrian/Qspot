import { firestore } from '../firebase/firebase.js';
import { parseDoc } from '../firebase/firebase-utils.js';
import { partyDataSelector, currentPartySelector } from '../reducers/party.js';
import { userLoaded } from './auth.js';

export const RECEIVE_PARTY = 'RECEIVE_PARTY';

export const getCurrentParty = () => async (dispatch, getState) => {
  await userLoaded();
  const state = getState();
  const currentParty = currentPartySelector(state);
  let partyData = partyDataSelector(state);
  if (partyData) return;
  partyData = parseDoc(await firestore.collection('parties').doc(currentParty).get());
  if (partyData) dispatch(receiveParty(partyData.id, partyData));
};

const receiveParty = (id, item) => {
  return {
    type: RECEIVE_PARTY,
    id,
    item
  };
};