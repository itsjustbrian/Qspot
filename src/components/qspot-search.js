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
import { repeat } from 'lit-html/lib/repeat';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

// These are the actions needed by this element.
import { setQuery, searchTracks, addTrackToQueue } from '../actions/search.js';

// We are lazy loading its reducer.
import search, { searchResultsSelector } from '../reducers/search.js';
store.addReducers({
  search,
});

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

class QspotSearch extends connect(store)(PageViewElement) {
  _render({
    _query,
    _tracks
  }) {
    return html`
      ${SharedStyles}
      <section>
        <p>
          <h2>Search for tracks</h2>
          <input id="search-input" aria-label="Search Tracks" autofocus type="search" value="${_query}"
              on-input="${(e) => store.dispatch(setQuery(e.target.value))}">
          <ul on-click="${(e) => this._handleAddTrack(e)}">
            ${repeat(_tracks, (track) => track.id, (track) => html`
            <li>
              <button data-track-id$="${track.id}">Add track</button>
              ${track.name} - ${track.artists.reduce((str, artist, index) => str + (index === 0 ? artist.name : ', ' + artist.name), '')}
            </li>`)}
          </ul>
        </p>
      </section>
    `;
  }

  static get properties() {
    return {
      _query: String,
      _tracks: Array
    };
  }

  // This is called every time something is updated in the store.
  _stateChanged(state) {
    this._query = state.search.query;
    this._tracks = searchResultsSelector(state);
  }

  _handleAddTrack(event) {
    const trackId = event.composedPath()[0].dataset.trackId;
    trackId && store.dispatch(addTrackToQueue(trackId));
  }
}

window.customElements.define('qspot-search', QspotSearch);

export { searchTracks };