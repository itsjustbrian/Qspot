import { getAccessToken, getClientToken } from './tokens';
import { spotifyAccountSelector } from '../reducers/auth';
import { fetchRetry } from '../util/fetch-utils';

export const RECEIVE_TRACK = 'RECEIVE_TRACK';
export const FAIL_TRACK = 'FAIL_TRACK';

export const getTrack = (id, origin) => async (dispatch, getState) => {
  const state = getState();
  let track = state.search && state.search.trackDataById && state.search.trackDataById[id] ||
    state.queue && state.queue.trackDataById && state.queue.trackDataById[id] ||
    state.myTracks && state.myTracks.trackDataById && state.myTracks.trackDataById[id];
  if (track) {
    dispatch(receiveTrack(id, track, origin));
    return;
  }
  const token = spotifyAccountSelector(state).linked ?
    await dispatch(getAccessToken()) : await dispatch(getClientToken());
  try {
    const response = await fetchRetry(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    track = await response.json();
    dispatch(receiveTrack(id, track, origin));
  } catch (error) {
    dispatch(failTrack(id, origin));
  }
};

const receiveTrack = (id, track, origin) => {
  return {
    type: RECEIVE_TRACK,
    origin,
    id,
    track
  };
};

const failTrack = (id, origin) => {
  return {
    type: FAIL_TRACK,
    origin,
    id
  };
};
