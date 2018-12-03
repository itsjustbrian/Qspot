import { html } from '@polymer/lit-element';
import { repeat } from 'lit-html/directives/repeat.js';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';
import { noSleep } from '../no-sleep/no-sleep-singleton.js';

import { store } from '../store.js';

import { attachQueueListener } from '../actions/queue';

// We are lazy loading its reducer.
import queue, { queueSelector } from '../reducers/queue.js';
import player from '../reducers/player.js';
store.addReducers({
  queue, player
});

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

import { playbackStateSelector } from '../reducers/player';
import { pausePlayer, resumePlayer, playNextInQueue } from '../actions/player';


// Note: a blank song state is possible. Do something like disable the playback
// controls in this case
class QspotQueue extends connect(store)(PageViewElement) {
  render() {
    const {
      _queue,
      _playbackState
    } = this;

    const currentTrack = _playbackState && _playbackState.currentTrack;

    return html`
      ${SharedStyles}
      <section>
        <h2>Queue</h2>
        <p>
          <button @click=${this._startPartyBtnClicked}>Start Party</button>
          ${_playbackState ? html`
          ${_playbackState.paused ? html`
          <button @click=${this._playBtnClicked}>Play</button>` : html`
          <button @click=${this._pauseBtnClicked}>Pause</button>`}
          ${currentTrack ? html`Now Playing: ${currentTrack.name}` : null}
          ` : null}
          <ol>
            ${repeat(_queue, (item) => item.id, (item) => html`
              <li>
                ${item.failure ? 'Error loading track' : !item.track ? 'Loading...' : this._getTrackTemplate(item.track)}
                <br>
                Added by: ${item.submitterName}
              </li>`)}
          </ol>
        </p>
      </section>
    `;
  }

  static get properties() {
    return {
      _queue: { type: Array },
      _playbackState: { type: Object }
    };
  }

  _getTrackTemplate(track) {
    return html`${track.name} - ${track.artists.reduce((str, artist, index) => str + (index === 0 ? artist.name : ', ' + artist.name), '')}`;
  }

  _startPartyBtnClicked() {
    noSleep.enable();
    store.dispatch(playNextInQueue());
  }

  _playBtnClicked() {
    store.dispatch(resumePlayer());
  }

  _pauseBtnClicked() {
    store.dispatch(pausePlayer());
  }

  stateChanged(state) {
    this._queue = queueSelector(state);
    this._playbackState = playbackStateSelector(state);
  }
}

window.customElements.define('qspot-queue', QspotQueue);

export { attachQueueListener };
