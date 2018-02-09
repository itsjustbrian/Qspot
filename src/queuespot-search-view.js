import { QueuespotElement, html } from './queuespot-element.js';
import { searchSpotifyForTracks, toSpotifySearchQuery } from './spotify-api.js';
import './queuespot-search-list.js';

class QueuespotSearchView extends QueuespotElement {

  static get properties() {
    return {
    };
  }

  constructor() {
    super();
  }

  ready() {
    super.ready();
  }

  render(props) {
    return html`
      <style>
        :host {
          display: block;
          contain: content
        }
      </style>
      <input id="search-input" type="search" on-input="${this.onSearchInput.bind(this)}}"></input>
      <queuespot-search-list id="search-list"></queuespot-search-list>
    `;
  }

  async onSearchInput(event) {
    const input = this.$('search-input').value;
    console.log('user typed input', input);
    if (!input.length) {
      return;
    }
    const query = toSpotifySearchQuery(input);
    if (this.lastQuery === query) {
      return;
    }
    this.lastQuery = query;
    const tracks = await searchSpotifyForTracks(query);
    if (tracks && this.lastQuery === query) {
      this.$('search-list').tracks = tracks;
    }
  }

}
customElements.define('queuespot-search-view', QueuespotSearchView);