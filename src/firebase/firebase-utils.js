import { firestore } from './firebase.js';

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