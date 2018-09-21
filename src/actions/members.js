import { firestore } from '../firebase/firebase.js';
import { parseSnapshot } from '../firebase/firebase-utils.js';
import { currentPartySelector } from '../reducers/party.js';

export const RECEIVE_PARTY_MEMBERS = 'RECEIVE_PARTY_MEMBERS';

let membersListener, membersPromise;
export const attachPartyMembersListener = () => (dispatch, getState) => {
  return membersPromise || (membersPromise = new Promise((resolve) => {
    const state = getState();
    const currentParty = currentPartySelector(state);
    membersListener = firestore.collection('parties').doc(currentParty).collection('members').where('numTracksAdded', '>', 0).onSnapshot((snapshot) => {
      const items = parseSnapshot(snapshot);
      dispatch(receivePartyMembers(items));
      resolve();
    });
  }));
};
export const detachPartyMembersListener = () => membersListener && (membersListener(), membersPromise = membersListener = null);

const receivePartyMembers = (items) => {
  return {
    type: RECEIVE_PARTY_MEMBERS,
    items
  };
};