import { loadScripts } from './script-loader.js';
import { TracksQueueListener, PartyDataListener } from './data-listeners.js';
import { playTrack } from './spotify-api.js';
import { advanceQueue } from './queuespot-actions.js';
import { noParallel } from './promise-utils.js';
import { tokenManager } from './spotify-token-manager.js';
import { NoSleep } from './no-sleep.js';

import { db } from './firebase-loader.js';

export const PLAYER_STATES = Object.freeze({
  NOT_LOADED: 0,
  LOADING: 1,
  STOPPED: 2,
  PLAYING: 3
});

/**
 * Singleton Spotify Web Player class
 */
class SpotifyWebPlayer extends EventTarget {

  constructor() {
    super();

    this.lifeCycle = PLAYER_STATES.NOT_LOADED;
    this.queue = [];
    this.party = null;
    this.currentQueueTrack = null;
    this.playerState = null;
    this.deviceId = null;
    this.noSleep = new NoSleep();
    this.tracksQueueListener = new TracksQueueListener((e) => this._onTracksReceived(e));
    this.partyDataListener = new PartyDataListener((e) => this._onPartyDataReceived(e));
    this.noParallelAdvanceQueue = noParallel(advanceQueue);
    this.noParallelPlayTrack = noParallel(playTrack);
  }

  async load() {
    this.lifeCycle = PLAYER_STATES.LOADING;

    // Don't await the script, just start listening for the sdkReady event
    loadScripts(['https://sdk.scdn.co/spotify-player.js'], true);

    await this._sdkReady();
    this.player = new Spotify.Player({
      name: 'Queuespot Party',
      getOAuthToken: (callback) => this._handleTokenRequest(callback),
      volume: 0.5
    });

    this.player.addListener('player_state_changed', (state) => this._handleStateChange(state));
    this.player.addListener('ready', (e) => this._onPlayerReady(e));
    this.player.addListener('initialization_error', (e) => console.error(e));
    this.player.addListener('authentication_error', (e) => console.error(e));
    this.player.addListener('account_error', (e) => console.error(e));
    this.player.addListener('playback_error', (e) => console.error(e));

    await this.player.connect();
    this.lifeCycle = PLAYER_STATES.STOPPED;
  }

  start(partyId) {
    if (this.lifeCycle !== PLAYER_STATES.STOPPED) {
      return;
    }
    this.lifeCycle = PLAYER_STATES.PLAYING;
    this.party = partyId;
    this.noSleep.enable();
    this.tracksQueueListener.attach(partyId);
  }

  stop() {
    if (this.lifeCycle === PLAYER_STATES.PLAYING) {
      return;
    }
    this.lifeCycle = PLAYER_STATES.STOPPED;
    this.noSleep.disable();
    this.tracksQueueListener.detach();
  }

  listenIn(partyId) {
    this.party = partyId;
    this.noSleep.enable();
    this.partyDataListener.attach(partyId);
  }

  stopListening() {
    this.noSleep.disable();
    this.partyDataListener.detach();
  }

  cleanup() {
    this.noSleep.disable();
    this.tracksQueueListener.detach();
    this.player.removeListener('ready');
    this.player.removeListener('initialization_error');
    this.player.removeListener('authentication_error');
    this.player.removeListener('account_error');
    this.player.removeListener('playback_error');
    this.player.disconnect();
  }

  _sdkReady() {
    return new Promise((resolve, reject) => {
      window.addEventListener('spotify-web-playback-ready', (e) => {
        resolve();
      }, {once: true});
    });
  }

  get ready() {
    if (!this.__playerIsReady) {
      this.__playerIsReady = new Promise((resolve) => {
        this.__resolvePlayerIsReady = () => {
          resolve();
        };
      });
    }
    return this.__playerIsReady;
  }

  _onPlayerReady({ device_id }) {
    console.log('Player ready with device ID', device_id);

    this.deviceId = device_id;
    this.__playerIsReady = true;
    if (this.__resolvePlayerIsReady) {
      this.__resolvePlayerIsReady();
    }
  }

  async _handleTokenRequest(callback) {
    console.log('Spotify requesting new token');

    // Have to temporarily remove this since ready event isnt called
    // after spotify sdk requests to replace an expired token
    //this.__playerIsReady = this.__resolvePlayerIsReady = null;
    const token = await tokenManager.getUserToken();
    callback(token);
  }

  _handleStateChange(playerState) {
    console.log('Player state', playerState);

    this.playerState = playerState;

    if (!playerState) {
      console.log('Player disconnected');

      this.dispatchEvent(new CustomEvent('player-disconnected', { detail: this.lifeCycle }));
      return;
    }

    this._publishState(playerState);

    if (this.lifeCycle === PLAYER_STATES.PLAYING && this._shouldAdvanceQueue(this.playerState, this.currentQueueTrack)) {
      this._playNextInQueue();
    }
  }

  async _playNextInQueue() {
    console.log('Playing next in queue');

    await this.ready; // Issue with waiting for ready after player detects token has expired
    this.currentQueueTrack = this.queue[0];
    if (this.currentQueueTrack) {
      this.noParallelAdvanceQueue(this.party, this.currentQueueTrack.id, this.currentQueueTrack.submitterId);
      this.noParallelPlayTrack(this.currentQueueTrack.id, this.deviceId);
    } else {
      console.log('No tracks to play');
    }
  }

  async _onTracksReceived(tracks) {
    console.log('Setting tracks for player', tracks);

    const currentQueue = this.queue;
    this.queue = tracks;
    // If we don't have anything to play and new tracks are coming in
    if (!this.currentQueueTrack && !currentQueue.length && tracks.length) {
      this._playNextInQueue();
    }
  }

  async _onPartyDataReceived(partyData) {
    console.log('Received party state', partyData.currentPlayerState);
    
    const oldState = this.playerState;
    const newState = partyData.currentPlayerState;
    this.playerState = newState;

    if (!oldState || this._trackIsStartingPlayback(newState)) {
      this.noParallelPlayTrack(newState.track_window.current_track.id);
    }
  }

  _publishState(state) {
    return db().collection('parties').doc(this.party).update({
      currentPlayerState: state
    });
  }

  _trackIsAtStart(playerState) {
    return playerState.position === 0;
  }

  _trackIsStartingPlayback(playerState) {
    const previousTrack = playerState.track_window.previous_tracks[0];
    return this._trackIsAtStart(playerState) && !previousTrack && !playerState.paused;
  }

  _onCurrentTrack(playerState, currentTrack) {
    const currentPlayerTrack = playerState.track_window.current_track;
    return !!currentTrack && !!currentPlayerTrack && currentPlayerTrack.id === currentTrack.id;
  }

  _finishedCurrentTrack(playerState, currentTrack) {
    const previousTrack = playerState.track_window.previous_tracks[0];
    return this._trackIsAtStart(playerState) &&
      this._onCurrentTrack(playerState, currentTrack) && !!previousTrack && previousTrack.id === currentTrack.id;
  }

  _currentTrackSkipped(playerState, currentTrack) {
    const previousTrack = playerState.track_window.previous_tracks[0];
    return this._trackIsAtStart(playerState) &&
      this._onCurrentTrack(playerState, currentTrack) && !previousTrack && playerState.paused;
  }
  
  _shouldAdvanceQueue(playerState, currentTrack) {
    return this._trackIsAtStart(playerState) &&
      (!currentTrack || this._finishedCurrentTrack(playerState, currentTrack) ||
        this._currentTrackSkipped(playerState, currentTrack));
  }
}

// Creates a singleton reference
export let spotifyWebPlayer = new SpotifyWebPlayer();