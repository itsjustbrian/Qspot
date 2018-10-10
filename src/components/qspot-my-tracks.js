import { html } from '@polymer/lit-element';
import { repeat } from 'lit-html/lib/repeat';
import { connect } from 'pwa-helpers/connect-mixin';
import { PageViewElement } from './page-view-element.js';

import { store } from '../store.js';

// Actions
import { loadMyTracks } from '../actions/my-tracks.js';

// We are lazy loading its reducer.
import myTracks, { myTracksSelector } from '../reducers/my-tracks.js';
import player from '../reducers/player.js';
import members from '../reducers/members.js';
store.addReducers({
  myTracks, player, members
});

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

class QspotMyTracks extends connect(store)(PageViewElement) {
  _render({ _myTracks }) {
    return html`
      ${SharedStyles}
      <section>
        <p>
          <h2>My Tracks</h2>
          <ol>
            ${repeat(_myTracks, (item) => item.id, (item) => html`
            <li>
              ${item.failure ? 'Error loading track' : !item.track ? 'Loading...' : this.getTrackTemplate(item.track)}
              <br>
              Position: ${item.positionInQueue}
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
      _myTracks: Array
    };
  }

  _stateChanged(state) {
    this._myTracks = myTracksSelector(state);
  }
}

window.customElements.define('qspot-my-tracks', QspotMyTracks);

export { loadMyTracks };