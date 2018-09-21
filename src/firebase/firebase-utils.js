import { firestore, Timestamp } from './firebase.js';

export const parseDoc = (doc) => {
  const item = doc && doc.data();
  if (item) item.id = doc.id;
  return item;
};

export const parseSnapshot = (snapshot) => {
  const items = [];
  snapshot && snapshot.forEach((doc) => {
    const item = doc.data();
    item.id = doc.id;
    items.push(item);
  });
  return items;
};

/**
 * Executes an action with a new batch by default,
 * but uses an existing batch if provided with one.
 * 
 * @param {*} batch
 * @param {function} doOperations 
 */
export const doBatchedAction = async (batch, doOperations) => {
  const usingBatch = batch ? batch : firestore.batch();
  await doOperations(usingBatch);
  return batch ? usingBatch : usingBatch.commit();
};


// Timestamp utils

const MAX_NANOSECONDS = 999999999;

export const greaterThan = (leftTimestamp, rightTimestamp) => {
  return leftTimestamp.seconds > rightTimestamp.seconds ||
    (leftTimestamp.seconds === rightTimestamp.seconds && leftTimestamp.nanoseconds > rightTimestamp.nanoseconds);
};

export const difference = (leftTimestamp, rightTimestamp) => {
  let seconds = leftTimestamp.seconds - rightTimestamp.seconds;
  let nanoseconds = leftTimestamp.nanoseconds - rightTimestamp.nanoseconds;
  if (nanoseconds < 0) {
    seconds--;
    nanoseconds += MAX_NANOSECONDS + 1;
  }
  return new Timestamp(seconds, nanoseconds);
};

export const sum = (leftTimestamp, rightTimestamp) => {
  let seconds = leftTimestamp.seconds + rightTimestamp.seconds;
  let nanoseconds = leftTimestamp.nanoseconds + rightTimestamp.nanoseconds;
  if (nanoseconds > MAX_NANOSECONDS) {
    seconds++;
    nanoseconds -= MAX_NANOSECONDS + 1;
  }
  return new Timestamp(seconds, nanoseconds);
};