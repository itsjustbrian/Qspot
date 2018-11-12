import { html } from '@polymer/lit-element';
import { repeat } from 'lit-html/directives/repeat.js';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

// These are the actions needed by this element.
import { setQuery, searchTracks, addTrackToQueue } from '../actions/search.js';

// We are lazy loading its reducer.
import search, { searchResultsSelector } from '../reducers/search.js';
import player from '../reducers/player.js';
store.addReducers({
  search, player
});

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

class QspotSearch extends connect(store)(PageViewElement) {
  render() {
    const {
      _query,
      _tracks
    } = this;

    return html`
      ${SharedStyles}
      <section>
        <p>
          <h2>Search for tracks</h2>
          <input id="search-input" title="Search Tracks" autofocus type="search" value=${_query}
              @input=${this._searchInputChanged}>
          <ul @click=${this._handleAddTrack}>
            ${repeat(_tracks, (track) => track.id, (track) => html`
            <li>
              <button data-track-id=${track.id}>Add track</button>
              ${track.name} - ${track.artists.reduce((str, artist, index) => str + (index === 0 ? artist.name : ', ' + artist.name), '')}
            </li>`)}
          </ul>
        </p>
      </section>
    `;
  }

  static get properties() {
    return {
      _query: { type: String },
      _tracks: { type: Array }
    };
  }

  _searchInputChanged(event) {
    store.dispatch(setQuery(event.target.value));
  }

  _handleAddTrack(event) {
    const trackId = event.composedPath()[0].dataset.trackId;
    trackId && store.dispatch(addTrackToQueue(trackId));
  }

  // This is called every time something is updated in the store.
  stateChanged(state) {
    this._query = state.search.query || '';
    this._tracks = searchResultsSelector(state);
  }
}

window.customElements.define('qspot-search', QspotSearch);

export { searchTracks };