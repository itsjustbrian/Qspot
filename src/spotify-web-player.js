import { loadScripts } from './script-loader.js';
import { TracksQueueListener } from './data-listeners.js';
import { playTrackOnSpotify } from './spotify-api.js';
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

  cleanup() {
    this.noSleep.disable();
    this.tracksQueueListener.detach();
    this.player.removeListener('ready');
    this.player.removeListener('initialization_error');
    this.player.removeListener('authentication_error');
    this.player.removeListener('account_error');
    this.player.removeListener('playback_error');
  }

  _sdkReady() {
    return new Promise((resolve, reject) => {
      window.addEventListener('spotify-web-playback-ready', function callback(e) {
        window.removeEventListener('spotify-web-playback-ready', callback);
        resolve();
      });
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

    this.__playerIsReady = this.__resolvePlayerIsReady = null;
    const token = await tokenManager.getNewUserToken();
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

    if (this.lifeCycle === PLAYER_STATES.PLAYING && this._shouldAdvanceQueue()) {
      this._playNextInQueue();
    }
  }

  async _playNextInQueue() {
    console.log('Playing next in queue');

    await this.ready;
    this.currentQueueTrack = this.queue[0];
    if (this.currentQueueTrack) {
      this._popQueueInDb();
      playTrackOnSpotify(this.currentQueueTrack.id, this.deviceId);
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

  async _popQueueInDb() {
    // Only one user (the host) should be executing this, so avoiding transactions is a-okay
    const partyDoc = await db().collection('parties').doc(this.party).get();
    const { numTracksPlayed } = partyDoc.data();
    const batch = db().batch();
    batch.delete(db().collection('parties').doc(this.party).collection('tracks').doc(this.currentQueueTrack.id));
    batch.update(db().collection('parties').doc(this.party), {
      numTracksPlayed: (numTracksPlayed || 0) + 1
    });
    return await batch.commit();
  }

  _trackIsAtStart() {
    return this.playerState.position === 0 && this.playerState.duration === 0;
  }

  _onCurrentTrack() {
    const currentPlayerTrack = this.playerState.track_window.current_track;
    return !!this.currentQueueTrack && !!currentPlayerTrack && currentPlayerTrack.id === this.currentQueueTrack.id;
  }

  _finishedCurrentTrack() {
    const previousTrack = this.playerState.track_window.previous_tracks[0];
    return this._trackIsAtStart() && this._onCurrentTrack() && !!previousTrack && previousTrack.id === this.currentQueueTrack.id;
  }

  _currentTrackSkipped() {
    const previousTrack = this.playerState.track_window.previous_tracks[0];
    return this._trackIsAtStart() && this._onCurrentTrack() && !previousTrack && this.playerState.paused;
  }
  
  _shouldAdvanceQueue() {
    return !this.currentQueueTrack || this._finishedCurrentTrack() || this._currentTrackSkipped();
  }
}

// Creates a singleton reference
export let spotifyWebPlayer = new SpotifyWebPlayer();