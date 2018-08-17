import { getAccessToken, getClientToken } from './tokens';
import { searchTrackDataSelector } from '../reducers/search';
import { queueTrackDataSelector } from '../reducers/queue';
import { spotifyAccountSelector } from '../reducers/auth';

export const REQUEST_TRACK = 'REQUEST_TRACK';
export const RECEIVE_TRACK = 'RECEIVE_TRACK';
export const FAIL_TRACK = 'FAIL_TRACK';

export const getTrack = (id) => async (dispatch, getState) => {
  dispatch(requestTrack(id));
  const state = getState();
  let track = searchTrackDataSelector(state)[id] || queueTrackDataSelector(state)[id];
  if (track) {
    dispatch(receiveTrack(id, track));
    return;
  }
  const token = spotifyAccountSelector(state).linked ?
    await dispatch(getAccessToken()) : await dispatch(getClientToken());
  try {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    track = await response.json();
    dispatch(receiveTrack(id, track));
  } catch (error) {
    dispatch(failTrack(id));
  }
};

const requestTrack = (id) => {
  return {
    type: REQUEST_TRACK,
    id
  };
};

const receiveTrack = (id, track) => {
  return {
    type: RECEIVE_TRACK,
    id,
    track
  };
};

const failTrack = (id) => {
  return {
    type: FAIL_TRACK,
    id
  };
};
