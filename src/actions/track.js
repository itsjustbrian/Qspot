import { fetchWithToken, ACCESS_TOKEN, CLIENT_TOKEN } from './tokens';
import { spotifyAccountSelector } from '../reducers/auth';

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
  try {
    const response = await dispatch(fetchWithToken(spotifyAccountSelector(getState()).linked ? ACCESS_TOKEN : CLIENT_TOKEN,
      `https://api.spotify.com/v1/tracks/${id}`));
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
