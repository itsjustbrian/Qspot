import { doBatchedAction, parseDoc } from '../firebase/firebase-utils';
import { firestore } from '../firebase/firebase';
import { userIdSelector, spotifyAccountSelector } from '../reducers/auth';

export const SUCCEED_JOIN_PARTY = 'SUCCEED_JOIN_PARTY';
export const FAIL_JOIN_PARTY = 'FAIL_JOIN_PARTY';
export const SUCCEED_CREATE_PARTY = 'SUCCEED_CREATE_PARTY';
export const FAIL_CREATE_PARTY = 'FAIL_CREATE_PARTY'; 

export const joinPartyWithCode = (code, batch) => async (dispatch) => {
  const party = await getPartyWithCode(code);
  if (!party) return dispatch(failJoinParty('Invalid party code'));
  dispatch(joinParty(party.id, batch));
};

export const joinParty = (id, batch) => async (dispatch, getState) => {
  try {
    await doBatchedAction(batch, async (batch) => {
      const state = getState();
      const currentUserId = userIdSelector(state);

      batch.update(firestore.collection('users').doc(currentUserId), {
        currentParty: id
      });

      const memberRef = firestore.collection('parties').doc(id).collection('members').doc(currentUserId);
      const isMember = !!await getPartyMemberData(id, state);

      // If we've already seen this member, we don't want to reset the number of tracks they've added.
      isMember ? batch.update(memberRef, { active: true }) :
        batch.set(memberRef, {
          numTracksAdded: 0,
          numTracksPlayed: 0,
          active: true
        });
    });
  } catch (error) {
    return dispatch(failJoinParty());
  }

  dispatch(succeedJoinParty());
  //dispatch(attachPartyListener());
};

const getPartyWithCode = async (code) => {
  const { docs } = await firestore.collection('parties').where('code', '==', code).get();
  return parseDoc(docs[0]);
};

const getPartyMemberData = async (partyId, state) => {
  return parseDoc(await firestore.collection('parties').doc(partyId).collection('members').doc(userIdSelector(state)).get());
};

const succeedJoinParty = () => {
  return {
    type: SUCCEED_JOIN_PARTY
  };
};

const failJoinParty = (error) => {
  return {
    type: FAIL_JOIN_PARTY,
    error
  };
};

export const createParty = () => async (dispatch, getState) => {
  const state = getState();
  const currentUserId = userIdSelector(state);
  const country = spotifyAccountSelector(state).country;
  const newPartyRef = firestore.collection('parties').doc();
  
  try {
    await doBatchedAction(null, async (batch) => {
      batch.set(newPartyRef, {
        host: currentUserId,
        country
      });

      // The creator/host must join the party
      await dispatch(joinParty(newPartyRef.id, batch));
    });
    const code = await generatePartyCode(newPartyRef.id);
    await newPartyRef.update({ code });
  } catch (error) {
    return dispatch(failCreateParty());
  }
  
  dispatch(succeedCreateParty());
};

export async function generatePartyCode(partyId) {
  try {
    let newCode;
    await firestore.runTransaction(async (transaction) => {
      newCode = randomLetters(4);
      const partyCodeRef = firestore.collection('party-codes').doc(newCode);
      const data = parseDoc(await transaction.get(partyCodeRef));
      if (data) {
        const parties = data.parties;
        let extensionNum = data.extensionNum;
        newCode += extensionNum > 0 ? extensionNum : '';
        parties[partyId] = extensionNum;
        extensionNum++;
        await transaction.set(partyCodeRef, {
          parties,
          extensionNum
        });
      } else {
        await transaction.set(partyCodeRef, {
          parties: { [partyId]: 0 },
          extensionNum: 1
        });
      }
    });
    if (!newCode) throw null;
    return newCode;
  } catch (error) {
    throw new Error('failed party code generation');
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const randomLetters = (numLetters) => {
  let letters = '';
  for (let i = 0; i < numLetters; i++) {
    const j = Math.floor(Math.random() * 26);
    letters += ALPHABET[j];
  }
  return letters;
};

export async function deletePartyCodeEntry(partyId) {
  const partyCodesRef = firestore.collection('party-codes');
  const { docs } = await partyCodesRef.where(`parties.${partyId}`, '>=', 0).get();
  if (!docs.length) return; // This party ID is not in the party-codes ledger, so nothing to delete
  try {
    await firestore.runTransaction(async (transaction) => {
      const codeData = parseDoc(await transaction.get(partyCodesRef.doc(docs[0].id)));
      if (!codeData) throw 'Code deleted';

      const parties = codeData.parties;
      if (Object.keys(parties).length > 1) {
        delete parties[partyId];
        transaction.update(partyCodesRef.doc(codeData.id), { parties });
      } else transaction.delete(partyCodesRef.doc(codeData.id));
    });
  } catch (error) {
    if (error !== 'Code deleted') throw error;
  }
}

const succeedCreateParty = () => {
  return {
    type: SUCCEED_CREATE_PARTY
  };
};

const failCreateParty = () => {
  return {
    type: FAIL_CREATE_PARTY
  };
};