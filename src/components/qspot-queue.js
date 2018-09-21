/**
@license
Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

import { html } from '@polymer/lit-element';
import { repeat } from '../../node_modules/lit-html/lib/repeat';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

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
import { pausePlayer, resumePlayer, playNextInQueue, listenToParty } from '../actions/player';


class QspotQueue extends connect(store)(PageViewElement) {
  _render({ _queue, _playbackState }) {
    const playbackState = _playbackState || {};
    const currentTrack = playbackState.currentTrack;

    return html`
      ${SharedStyles}
      <section>
        <h2>Queue</h2>
        <p>
          ${html`
            <button on-click="${() => store.dispatch(playNextInQueue())}">Start Party</button>
            <button on-click="${() => store.dispatch(listenToParty())}">Listen to Party</button>
            <button on-click="${() => store.dispatch(playbackState.paused ? resumePlayer() : pausePlayer())}">
              ${playbackState.paused ? 'Play' : 'Pause'}
            </button>
            ${currentTrack && html`Now Playing: ${currentTrack.name}`}
          `}
          <ol>
            ${repeat(_queue, (item) => item.id, (item) => html`
              <li>
                ${item.failure ? 'Error loading track' : !item.track ? 'Loading...' : this.getTrackTemplate(item.track)}
                <br>
                Added by: ${item.submitterName}
              </li>`)}
          </ol>
        </p>
      </section>
    `;
  }

  getTrackTemplate(track) {
    return html`${track.name} - ${track.artists.reduce((str, artist, index) => str + (index === 0 ? artist.name : ', ' + artist.name), '')}`;
  }

  static get properties() {
    return {
      _queue: Array,
      _playbackState: Object
    };
  }

  _stateChanged(state) {
    this._queue = queueSelector(state);
    this._playbackState = playbackStateSelector(state);
  }
}

window.customElements.define('qspot-queue', QspotQueue);

export { attachQueueListener };
