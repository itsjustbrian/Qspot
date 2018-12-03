import { firestore, Timestamp } from '../firebase/firebase.js';
import { loadScripts } from '../util/script-loader.js';
import { formatBody } from '../util/fetch-utils.js';
import { takeLatest } from '../util/promise-utils.js';
import { subscribe } from './player-middleware.js';
import { currentPartySelector } from '../reducers/party.js';
import { playbackStateSelector, playerLoadedSelector, playerActiveSelector } from '../reducers/player.js';
import { getAccessToken } from '../actions/tokens.js';
import {
  playNextInQueue,
  playerError,
  playbackStateChanged,
  PLAYER_CONNECTED,
  PLAYER_DISCONNECTED,
  PLAYER_READY,
  PLAYER_NOT_READY,
  PLAYER_CREATED
} from '../actions/player.js';

export const PLAYER_ORIGIN = 'PLAYER_ORIGIN';

export const installPlayer = async (store) => {
  if (playerLoadedSelector(store.getState())) return;
  const sdkLoaded = new Promise((resolve) => window.onSpotifyWebPlaybackSDKReady = resolve);
  loadScripts('https://sdk.scdn.co/spotify-player.js');
  await sdkLoaded;
  const player = new Spotify.Player({
    name: 'Qspot',
    getOAuthToken: async (callback) => callback(await store.dispatch(getAccessToken())),
    volume: 0.5
  });
  const playerDeviceId = player._options.id;

  store.dispatch({ type: PLAYER_CREATED, deviceId: playerDeviceId });

  let playerReadyPromise, resolvePlayerReady;
  const playerReady = () => {
    if (playerReadyPromise) return playerReadyPromise;
    return playerReadyPromise = new Promise((resolve) => {
      resolvePlayerReady = (deviceId) => {
        resolve(deviceId);
      };
    });
  };

  player.addListener('ready', async ({ device_id }) => {
    console.log('Ready with device id:', device_id);
    store.dispatch({ type: PLAYER_READY, deviceId: device_id });
    playerReadyPromise = true;
    resolvePlayerReady && resolvePlayerReady(device_id);
  });

  player.addListener('not_ready', ({ device_id }) => {
    store.dispatch({ type: PLAYER_NOT_READY, deviceId: device_id });
    playerReadyPromise = resolvePlayerReady = null;
  });

  let oldPlaybackState;
  player.addListener('player_state_changed', (playerState) => {
    if (!playerState) {
      oldPlaybackState = null;
      store.dispatch({ type: PLAYER_DISCONNECTED, origin: PLAYER_ORIGIN });
      return;
    } else if (!oldPlaybackState) {
      store.dispatch({ type: PLAYER_CONNECTED, origin: PLAYER_ORIGIN });
    }

    const newPlaybackState = reduceSpotifyPlayerState(playerState);
    console.log('Old playback state', oldPlaybackState);
    console.log('New playback state', newPlaybackState);

    if (oldPlaybackState &&
      (finishedCurrentTrack(newPlaybackState, oldPlaybackState) ||
        currentTrackSkipped(newPlaybackState, oldPlaybackState))) {
      store.dispatch(playNextInQueue());
    } else if (relevantStateChanged(newPlaybackState, oldPlaybackState)) {
      const currentParty = currentPartySelector(state);
      firestore.collection('parties').doc(currentParty).update({
        playbackState: {
          ...newPlaybackState,
          lastUpdated: Timestamp.now()
        }
      });
      store.dispatch(playbackStateChanged(newPlaybackState, PLAYER_ORIGIN));
    }

    oldPlaybackState = newPlaybackState;
  });

  player.addListener('initialization_error', ({ message }) => store.dispatch(playerError('initialization_error', message)));
  player.addListener('authentication_error', ({ message }) => store.dispatch(playerError('authentication_error', message)));
  player.addListener('account_error', ({ message }) => store.dispatch(playerError('account_error', message)));
  player.addListener('playback_error', ({ message }) => store.dispatch(playerError('playback_error', message)));

  await player.connect();
  const deviceId = await playerReady();

  const state = store.getState();

  // Transfer playback to this player
  const token = await store.dispatch(getAccessToken());
  await fetch('https://api.spotify.com/v1/me/player', {
    body: formatBody({ device_ids: [deviceId] }),
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });

  const handleSubscription = takeLatest(async (previousState, currentState) => {
    const { paused: wasPaused, position: previousPosition } = playbackStateSelector(previousState) || {};
    const { position: nextPosition, paused: isPaused } = playbackStateSelector(currentState) || {};
    const playerActive = playerActiveSelector(currentState);

    if (!playerActive) return;

    if (wasPaused && !isPaused) player.resume();
    if (!wasPaused && isPaused) player.pause();
    if (previousPosition !== nextPosition) player.seek(playbackStateSelector(currentState));
  });
  
  // Subscribe to middleware
  subscribe((next, action) => {
    const previousState = store.getState();
    next(action);
    const currentState = store.getState();

    if (action.origin === PLAYER_ORIGIN) return;

    handleSubscription(previousState, currentState);
  });
};

const reduceSpotifyPlayerState = (playerState) => {
  if (!playerState) return null;
  const {
    paused, position,
    track_window: {
      current_track: currentTrack,
      previous_tracks: [previousTrack]
    }
  } = playerState;
  return {
    paused,
    position,
    currentTrack: reduceSpotifyTrack(currentTrack),
    previousTrack: reduceSpotifyTrack(previousTrack)
  };
};

const reduceSpotifyTrack = (track) => {
  return track ? {
    album: track.album,
    artists: track.artists,
    id: track.id,
    name: track.name,
    uri: track.uri,
    duration: track.duration_ms
  } : null;
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
    newCurrentTrack.duration !== oldCurrentTrack.duration;
};

/**
 * Detecting this is a little tricky, since a skipped track is hard
 * to distinguish from other state changes. However, skipping will always
 * trigger 2 state changes with the second changing the duration property. So
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
      lastDuration === oldPlaybackState.currentTrack.duration) {
      lastDuration = null;
      return true;
    }
    lastDuration = newPlaybackState.currentTrack.duration;
  } else {
    lastDuration = null;
  }
  return false;
};