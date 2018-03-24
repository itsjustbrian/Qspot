import { db } from './firebase-loader.js';
import { parseDoc } from './firebase-utils.js';

/**
 * Executes an action with a new batch by default,
 * but uses an existing batch if provided with one.
 * 
 * @param {*} batch 
 * @param {function} doOperations 
 */
async function doBatchedAction(batch, doOperations) {
  const usingBatch = batch ? batch : db().batch();
  await doOperations(usingBatch);
  return batch ? usingBatch : usingBatch.commit();
}

export async function saveUser(uid, displayName, email, photoURL, batch) {

  return await doBatchedAction(batch, (batch) => {
    batch.set(db().collection('users').doc(uid), {
      displayName: displayName,
      email: email,
      photoURL: photoURL
    }, { merge: true });
  });
}

export async function createParty(userId, batch) {

  return await doBatchedAction(batch, async (batch) => {
    const newPartyRef = db().collection('parties').doc();
    batch.set(newPartyRef, {
      code: 'TIOS', // want to eventually generate
      host: userId
    });
    
    // The creator/host must join the party
    await joinParty(userId, newPartyRef.id, batch);
  });
}

export async function joinParty(userId, partyId, batch) {

  return await doBatchedAction(batch, async (batch) => {
    batch.update(db().collection('users').doc(userId), {
      currentParty: partyId
    });

    // If we've already seen this member, we don't want to reset the number of tracks they've added.
    const memberRef = db().collection('parties').doc(partyId).collection('members').doc(userId);
    const memberDoc = await getMember(userId, partyId, true);
    if (memberDoc.exists) {
      batch.update(memberRef, { active: true });
    } else {
      batch.set(memberRef, {
        numTracksAdded: 0,
        active: true
      });
    }

  });
}

export async function getParty(partyId, returnDoc) {
  const partyDoc = await db().collection('parties').doc(partyId).get();
  return returnDoc ? partyDoc : parseDoc(partyDoc);
}

export async function getPartyWithCode(code, returnDoc) {
  const { docs } = await db().collection('parties').where('code', '==', code).get();
  return returnDoc ? docs[0] : parseDoc(docs[0]);
}

export async function getMember(userId, partyId, returnDoc) {
  const memberDoc = await db().collection('parties').doc(partyId).collection('members').doc(userId).get();
  return returnDoc ? memberDoc : parseDoc(memberDoc);
}