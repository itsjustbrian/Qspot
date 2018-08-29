import { firestore } from '../firebase/firebase.js';
import { parseDoc } from '../firebase/firebase-utils.js';
import { partyDataSelector, currentPartySelector } from '../reducers/party.js';
import { userLoaded } from './auth.js';

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

const receiveParty = (item) => {
  return {
    type: RECEIVE_PARTY,
    item
  };
};