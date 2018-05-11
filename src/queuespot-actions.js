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
        numTracksPlayed: 0,
        active: true
      });
    }
  });
}

export async function addTrackToQueue(userId, displayName, partyId, trackId, batch) {

  return await doBatchedAction(batch, async (batch) => {
    const existingTrack = await getTrack(partyId, trackId);
    if (existingTrack) {
      throw new Error('This track is already in the queue');
    }
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    let timeFirstTrackAdded = timestamp;
    let numTracksAdded;
    const member = await getMember(userId, partyId);
    numTracksAdded = member.numTracksAdded + 1;
    const memberDocUpdate = {
      numTracksAdded: numTracksAdded
    };
    if (numTracksAdded === 1) {
      memberDocUpdate.timeFirstTrackAdded = timestamp;
    } else {
      timeFirstTrackAdded = member.timeFirstTrackAdded;
    }
    batch.update(db().collection('parties').doc(partyId).collection('members').doc(userId), memberDocUpdate);
    batch.set(db().collection('parties').doc(partyId).collection('tracks').doc(trackId), {
      submitterId: userId,
      submitterName: displayName,
      trackNumber: numTracksAdded,
      memberOrderStamp: timeFirstTrackAdded,
      timestamp: timestamp
    });
  });
}

export async function advanceQueue(partyId, trackId, submitterId, batch) {

  return await doBatchedAction(batch, async (batch) => {
    const memberDoc = await getMember(submitterId, partyId, true);
    if (!memberDoc.exists) {
      throw new Error('Member does not exist');
    }
    const { numTracksPlayed } = memberDoc.data();
    await deleteTrack(partyId, trackId, batch);
    // Only one user (the host) should be executing this, so avoiding transactions is a-okay
    batch.update(db().collection('parties').doc(partyId).collection('members').doc(submitterId), {
      numTracksPlayed: numTracksPlayed + 1
    });
  });
}

export async function deleteTrack(partyId, trackId, batch) {

  return await doBatchedAction(batch, async (batch) => {
    batch.delete(db().collection('parties').doc(partyId).collection('tracks').doc(trackId));
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

export async function getTrack(partyId, trackId, returnDoc) {
  const trackDoc = await db().collection('parties').doc(partyId).collection('tracks').doc(trackId).get();
  return returnDoc ? trackDoc : parseDoc(trackDoc);
}