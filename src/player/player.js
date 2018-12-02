import { firestore, Timestamp } from '../firebase/firebase.js';
import { difference } from '../firebase/firebase-utils.js';
import { loadScripts } from '../util/script-loader.js';
import { formatBody, fetchRetry } from '../util/fetch-utils.js';
import { takeLatest } from '../util/promise-utils.js';
import { subscribe } from './player-middleware.js';
import { currentPartySelector, isHostSelector } from '../reducers/party.js';
import { playbackStateSelector, playerLoadedSelector, playerActiveSelector } from '../reducers/player.js';
import { getAccessToken } from '../actions/tokens.js';
import {
  playNextInQueue,
  playTrack,
  playerError,
  playbackStateChanged,
  PLAYER_CONNECTED,
  PLAYER_DISCONNECTED,
  PLAYER_READY,
  PLAYER_NOT_READY,
  PLAYER_CREATED
} from '../actions/player.js';

export const PLAYER_ORIGIN = 'PLAYER_ORIGIN';
const SEEK_TOLERANCE_MS = 1000;
const PLAY_TRACK_TIMEOUT_MS = 4000;

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

  // Convert this ugly thing to a Class maybe?
  let resolveRequestedTrack, getRequestedTrackId;
  const requestedTrackPlayed = (trackId) => {
    getRequestedTrackId = () => trackId;
    return new Promise((resolve) => {
      resolveRequestedTrack = () => {
        resolve();
        resolveRequestedTrack = getRequestedTrackId = null;
      };
      setTimeout(() => {
        !!resolveRequestedTrack && resolveRequestedTrack();
      }, PLAY_TRACK_TIMEOUT_MS);
    });
  };

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

    // Verify that a track played by Spotify's play endpoint actually played
    const requestedTrackId = !!getRequestedTrackId && getRequestedTrackId();
    const currentTrackId = newPlaybackState.currentTrack && newPlaybackState.currentTrack.id;
    if (requestedTrackId && requestedTrackId === currentTrackId && oldPlaybackState &&
      !currentTrackChanged(newPlaybackState, oldPlaybackState) &&
      trackDurationChanged(newPlaybackState, oldPlaybackState)) {
      resolveRequestedTrack();
    }

    const currentUserIsHost = isHostSelector(store.getState());    
    if (currentUserIsHost) {
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
  const currentUserIsHost = isHostSelector(state);

  // Adjusts for playback that continued on host device since last state update
  const getAdjustedPosition = (playbackState) => {
    const { paused, position, lastUpdated } = playbackState || {};
    if (!currentUserIsHost && !paused && lastUpdated)
      return position + difference(Timestamp.now(), lastUpdated).toMillis();
    else return position;
  };

  // Transfer playback to this player
  const initialPlaybackState = playbackStateSelector(state);
  if (initialPlaybackState && !initialPlaybackState.paused) {
    const initialTrackId = initialPlaybackState.currentTrack.id;
    const trackPlayedPromise = requestedTrackPlayed(initialTrackId);
    store.dispatch(playTrack(initialTrackId)).catch(resolveRequestedTrack);
    await trackPlayedPromise;
    player.seek(getAdjustedPosition(initialPlaybackState));
  } else if (currentUserIsHost) {
    const token = await store.dispatch(getAccessToken());
    await fetchRetry('https://api.spotify.com/v1/me/player', {
      body: formatBody({ device_ids: [deviceId] }),
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  const handleSubscription = takeLatest(async (previousState, currentState) => {
    const { currentTrack: previousTrack, paused: wasPaused, position: previousPosition } = playbackStateSelector(previousState) || {};
    const { currentTrack, position: nextPosition, paused: isPaused } = playbackStateSelector(currentState) || {};
    const playerActive = playerActiveSelector(currentState);

    if (currentTrack && !isPaused && (!playerActive || (previousTrack && previousTrack.id) !== currentTrack.id)) {
      const trackPlayedPromise = requestedTrackPlayed(currentTrack.id);
      store.dispatch(playTrack(currentTrack.id)).catch(resolveRequestedTrack);
      await trackPlayedPromise;
    }

    if (!playerActive) return;

    if (wasPaused && !isPaused) player.resume();
    if (!wasPaused && isPaused) player.pause();

    if (previousPosition !== nextPosition) {
      const playerState = await player.getCurrentState();
      const adjustedPosition = getAdjustedPosition(playbackStateSelector(currentState));
      if (Math.abs(playerState.position - adjustedPosition) > SEEK_TOLERANCE_MS) player.seek(adjustedPosition);
    }
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