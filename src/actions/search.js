import { formatUrl } from '../util/fetch-utils.js';
import { Debouncer } from '@polymer/polymer/lib/utils/debounce.js';
import { timeOut } from '@polymer/polymer/lib/utils/async.js';
import { sequentialize } from '../util/promise-utils.js';
import { firestore, FieldValue } from '../firebase/firebase.js';
import { parseDoc, doBatchedAction } from '../firebase/firebase-utils.js';

import { getClientToken, getAccessToken } from './tokens.js';
import { replaceLocationURL } from './app.js';
import { requestedQuerySelector } from '../reducers/search.js';
import { spotifyAccountSelector, userSelector } from '../reducers/auth.js';
import { partyDataSelector, currentPartySelector } from '../reducers/party.js';

export const SET_QUERY = 'SET_QUERY';
export const REQUEST_SEARCH_TRACKS = 'REQUEST_SEARCH_TRACKS';
export const RECEIVE_SEARCH_TRACKS = 'RECEIVE_SEARCH_TRACKS';
export const FAIL_SEARCH_TRACKS = 'FAIL_SEARCH_TRACKS';

const SEARCH_LIMIT = 10;

export const setQuery = (query) => (dispatch) => {
  dispatch({ type: SET_QUERY, query });
  dispatch(replaceLocationURL(`/search${query && '?q=' + query}`));
};

let debounceSearchJob, controller, signal;
export const searchTracks = (query) => async (dispatch, getState) => {
  if (!query || !query.length) return;
  debounceSearchJob = Debouncer.debounce(debounceSearchJob, timeOut.after(300), async () => {
    query = encodeQuery(query);
    let previousQuery = requestedQuerySelector(getState());
    if (previousQuery === query) return;
    if (controller) controller.abort();
    controller = new AbortController();
    signal = controller.signal;
    dispatch(requestSearchTracks(query));
    const token = spotifyAccountSelector(getState()).linked ?
      await dispatch(getAccessToken()) : await dispatch(getClientToken());
    const market = partyDataSelector(getState()).country;
    try {
      const response = await fetch(formatUrl('https://api.spotify.com/v1/search', {
        q: query,
        limit: SEARCH_LIMIT,
        type: 'track',
        best_match: 'true',
        market
      }), {
        signal,
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const repsonseData = await response.json();
      const tracks = repsonseData.tracks.items;
      
      previousQuery = requestedQuerySelector(getState());
      if (previousQuery === query) {
        dispatch(receiveSearchTracks(tracks));
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        dispatch(failSearchTracks());
      }
      console.log(error);
    }
  });
};

const encodeQuery = (query) => {
  // Check if last 2 characters of query are alphanumueric,
  // and if so, add wildcard to query. Wildcards improve search
  // results but can produce errors without this precaution
  if (query.length > 2 && /^[a-zA-Z0-9]{2}$/.test(query.slice(-2))) {
    return query += '*';
  }
  return query;
};

const requestSearchTracks = (query) => {
  return {
    type: REQUEST_SEARCH_TRACKS,
    query
  };
};

const receiveSearchTracks = (results) => {
  return {
    type: RECEIVE_SEARCH_TRACKS,
    results
  };
};

const failSearchTracks = (query) => {
  return {
    type: FAIL_SEARCH_TRACKS,
    query
  };
};

const _addTrackToQueue = sequentialize(async (id, batch, getState) => {
  await doBatchedAction(batch, async (batch) => {
    const state = getState();
    const existingTrack = await getQueueTrack(id, state);
    if (existingTrack) throw new Error('This track is already in the queue');
    const timestamp = FieldValue.serverTimestamp();
    let timeFirstTrackAdded = timestamp;
    const member = await getPartyMemberData(state);
    const numTracksAdded = member.numTracksAdded + 1;
    const memberDocUpdate = { numTracksAdded };
    numTracksAdded === 1 ? memberDocUpdate.timeFirstTrackAdded = timestamp :
      timeFirstTrackAdded = member.timeFirstTrackAdded;
    const currentUser = userSelector(state);
    const currentParty = currentPartySelector(state);
    batch.update(firestore.collection('parties').doc(currentParty).collection('members').doc(currentUser.id), memberDocUpdate);
    batch.set(firestore.collection('parties').doc(currentParty).collection('tracks').doc(id), {
      submitterId: currentUser.id,
      submitterName: currentUser.displayName,
      trackNumber: numTracksAdded,
      memberOrderStamp: timeFirstTrackAdded,
      timestamp
    });
  });
});
export const addTrackToQueue = (id, batch) => (_, getState) => {
  _addTrackToQueue(id, batch, getState);
};

const getQueueTrack = async (id, state) => {
  return parseDoc(await firestore.collection('parties').doc(currentPartySelector(state)).collection('tracks').doc(id).get());
};

const getPartyMemberData = async (state) => {
  return parseDoc(await firestore.collection('parties').doc(currentPartySelector(state)).collection('members').doc(userSelector(state).id).get());
};