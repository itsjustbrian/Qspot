import { Debouncer } from '@polymer/polymer/lib/utils/debounce.js';
import { timeOut } from '@polymer/polymer/lib/utils/async.js';
//import { encodeQuery, searchForTracks } from '../spotify/spotify-api.js';

import { getClientToken } from './tokens.js';
import { replaceLocationURL } from './app.js';
import { requestedQuerySelector } from '../reducers/search.js';

export const REQUEST_TRACKS = 'REQUEST_TRACKS';
export const RECEIVE_TRACKS = 'RECEIVE_TRACKS';
export const FAIL_TRACKS = 'FAIL_TRACKS';

export const ADD_TRACK_TO_QUEUE = 'ADD_TRACK_TO_QUEUE';

export const setQuery = (query) => (dispatch, getState) => {
  dispatch(replaceLocationURL(`/search${query && '?q=' + query}`));
};

let debounceSearchJob, controller, signal;
export const searchTracks = (query) => (dispatch, getState) => {
  if (!query || !query.length) return;
  debounceSearchJob = Debouncer.debounce(debounceSearchJob, timeOut.after(300), async () => {
    query = encodeQuery(query);
    if (previousQuery(getState()) === query) return;
    if (controller) controller.abort();
    controller = new AbortController();
    signal = controller.signal;
    dispatch(requestTracks(query));
    const token = await dispatch(getClientToken());
    //const market = getState().party.country;
    let market = 'US'; let limit = '10';
    try {
      const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&limit=${limit}&type=track&best_match=true${market ? `&market=${market}` : ''}`, {
        signal,
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const repsonseData = await response.json();
      const tracks = repsonseData.tracks.items;

      if (previousQuery(getState()) === query) {
        dispatch(receiveTracks(tracks));
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        dispatch(failTracks());
      }
    }
    //const tracks = await searchForTracks(query, this.party && this.party.country);
  });
};

const previousQuery = (state) => {
  return requestedQuerySelector(state);
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

const requestTracks = (query) => {
  return {
    type: REQUEST_TRACKS,
    query
  };
};

const receiveTracks = (tracks) => {
  return {
    type: RECEIVE_TRACKS,
    tracks
  };
};

const failTracks = (query) => {
  return {
    type: FAIL_TRACKS,
    query
  };
};

export const addTrackToQueue = () => {

};
