import { firestore } from '../firebase/firebase.js';
import { subscribe } from './player-middleware.js';
import { loadScripts } from '../util/script-loader.js';
import { currentPartySelector } from '../reducers/party.js';
import { playbackStateSelector, playerLoadedSelector } from '../reducers/player.js';
import { getAccessToken } from '../actions/tokens.js';
import {
  playNextInQueue,
  playerError,
  playbackStateChanged,
  PLAYER_DISCONNECTED,
  PLAYER_READY,
  PLAYER_NOT_READY,
  PLAYER_CREATED
} from '../actions/player.js';

const PLAYER_ORIGIN = 'PLAYER_ORIGIN';

export const installPlayer = async (store) => {
  if (playerLoadedSelector(store.getState())) return;
  const sdkLoaded = new Promise((resolve) => window.onSpotifyWebPlaybackSDKReady = resolve);
  loadScripts(['https://sdk.scdn.co/spotify-player.js'], true);
  await sdkLoaded;
  const player = new Spotify.Player({
    name: 'Qspot',
    getOAuthToken: async (callback) => callback(await store.dispatch(getAccessToken())),
    volume: 0.5
  });
  const playerDeviceId = player._options.id;

  store.dispatch({ type: PLAYER_CREATED, deviceId: playerDeviceId });

  player.addListener('ready', async ({ device_id }) => {
    console.log('Device id:', device_id);
    if (!playerLoadedSelector(store.getState())) {
      const token = await store.dispatch(getAccessToken());
      await fetch('https://api.spotify.com/v1/me/player', {
        body: JSON.stringify({ device_ids: [device_id] }),
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
    }

    store.dispatch({ type: PLAYER_READY, deviceId: device_id });
  });
  player.addListener('not_ready', ({ device_id }) => store.dispatch({ type: PLAYER_NOT_READY, deviceId: device_id }));

  let oldPlaybackState;
  player.addListener('player_state_changed', (playerState) => {
    if (!playerState) return store.dispatch({ type: PLAYER_DISCONNECTED, origin: PLAYER_ORIGIN });
    const newPlaybackState = reduceSpotifyPlayerState(playerState);

    console.log('Old playback state', oldPlaybackState);
    console.log('New playback state', newPlaybackState);
    
    if (oldPlaybackState &&
      (finishedCurrentTrack(newPlaybackState, oldPlaybackState) ||
        currentTrackSkipped(newPlaybackState, oldPlaybackState))) {
      store.dispatch(playNextInQueue());
    } else if (relevantStateChanged(newPlaybackState, oldPlaybackState)) {
      const currentParty = currentPartySelector(store.getState());
      firestore.collection('parties').doc(currentParty).update({ playbackState: newPlaybackState });
      store.dispatch(playbackStateChanged(newPlaybackState, PLAYER_ORIGIN));
    }

    oldPlaybackState = newPlaybackState;
  });

  player.addListener('initialization_error', ({ message }) => store.dispatch(playerError('initialization_error', message)));
  player.addListener('authentication_error', ({ message }) => store.dispatch(playerError('authentication_error', message)));
  player.addListener('account_error', ({ message }) => store.dispatch(playerError('account_error', message)));
  player.addListener('playback_error', ({ message }) => store.dispatch(playerError('playback_error', message)));

  await player.connect();

  subscribe((next, action) => {
    const { paused: wasPaused, position: previousPosition } = playbackStateSelector(store.getState()) || {};
    next(action);
    const { paused: isPaused, position: nextPosition } = playbackStateSelector(store.getState()) || {};

    if (action.origin === PLAYER_ORIGIN) return;

    if (wasPaused && !isPaused) player.resume();
    if (!wasPaused && isPaused) player.pause();
    if (previousPosition !== nextPosition) player.seek(nextPosition);
  });
};

const reduceSpotifyPlayerState = (playerState) => {
  if (!playerState) return null;
  const { paused, position, track_window } = playerState;
  const { current_track, previous_tracks } = track_window;
  return {
    paused,
    position,
    currentTrack: current_track,
    previousTrack: previous_tracks[0] || null
  };
};

const relevantStateChanged = (newPlaybackState, oldPlaybackState) => {
  return !oldPlaybackState ||
    oldPlaybackState.paused !== newPlaybackState.paused ||
    oldPlaybackState.position !== newPlaybackState.position ||
    oldPlaybackState.currentTrack.id !== newPlaybackState.currentTrack.id;
};

const currentTrackChanged = (newPlaybackState, oldPlaybackState) => {
  const newCurrentTrackId = (newPlaybackState.currentTrack && newPlaybackState.currentTrack.id) || '';
  const oldCurrentTrackId = (oldPlaybackState.currentTrack && oldPlaybackState.currentTrack.id) || '';
  return newCurrentTrackId !== oldCurrentTrackId;
};

const finishedCurrentTrack = (newPlaybackState, oldPlaybackState) => {
  const newPreviousTrack = newPlaybackState.previousTrack;
  const oldPreviousTrack = oldPlaybackState.previousTrack;
  const oldCurrentTrack = oldPlaybackState.currentTrack;
  return !currentTrackChanged(newPlaybackState, oldPlaybackState) &&
    newPlaybackState.position === 0 &&
    newPlaybackState.paused &&
    !oldPreviousTrack && !!newPreviousTrack &&
    newPreviousTrack.id === oldCurrentTrack.id;
};

const trackDurationChanged = (newPlaybackState, oldPlaybackState) => {
  const newCurrentTrack = newPlaybackState.currentTrack;
  const oldCurrentTrack = oldPlaybackState.currentTrack;
  return !!newCurrentTrack && !!oldCurrentTrack &&
    newCurrentTrack.duration_ms !== oldCurrentTrack.duration_ms;
};

/**
 * Detecting this is a little tricky, since a skipped track is hard
 * to distinguish from other state changes. However, skipping will always
 * trigger 2 state changes with the second changing the duration_ms property. So
 * we need to save this value with a gross global-scope variable to compare
 * with later
 */
let lastDuration;
const currentTrackSkipped = (newPlaybackState, oldPlaybackState) => {
  const newPreviousTrack = newPlaybackState.previousTrack;
  const oldPreviousTrack = oldPlaybackState.previousTrack;
  if (!currentTrackChanged(newPlaybackState, oldPlaybackState) &&
    newPlaybackState.position === 0 &&
    !oldPreviousTrack && !newPreviousTrack &&
    newPlaybackState.paused) {
    if (trackDurationChanged(newPlaybackState, oldPlaybackState) &&
      lastDuration === oldPlaybackState.currentTrack.duration_ms) {
      lastDuration = null;
      return true;
    }
    lastDuration = newPlaybackState.currentTrack.duration_ms;
  } else {
    lastDuration = null;
  }
  return false;
};