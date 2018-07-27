import { Debouncer } from '../node_modules/@polymer/polymer/lib/utils/debounce.js';
import { timeOut } from '../node_modules/@polymer/polymer/lib/utils/async.js';
import { QueuespotElement, html } from './queuespot-element.js';
import { currentUser } from './firebase-loader.js';
import { toSearchQuery } from './spotify-api.js';
import { searchForTracks } from './track-data-manager.js';
import { addTrackToQueue } from './queuespot-actions.js';
import { noParallel } from './promise-utils.js';
import './queuespot-search-list.js';

class QueuespotSearchView extends QueuespotElement {

  static get properties() {
    return {
      party: Object,
      tracks: Array
    };
  }

  constructor() {
    super();

    this.party = null;
    this._onSearchInput = (e) => this.onSearchInput(e);
    this.noParallelAddTrackToQueue = noParallel(addTrackToQueue);
  }

  ready() {    
    super.ready();
    
    this.$('search-list').addEventListener('track-selected', (e) => this.onTrackSelected(e));
  }

  _render({ tracks }) {
    return html`
      <style>
        :host {
          display: block;
          contain: content
        }
      </style>
      <input id="search-input" type="search" on-input="${this._onSearchInput}}"></input>
      <queuespot-search-list id="search-list" tracks="${tracks}"></queuespot-search-list>
    `;
  }

  async onSearchInput(event) {
    this._debounceSearchJob = Debouncer.debounce(this._debounceSearchJob, timeOut.after(300), async () => {
      const input = this.$('search-input').value;
      console.log('Searching with input:', input);
      const tracks = await this.trySearch(input);
      tracks && (this.tracks = tracks);
    });
  }

  async trySearch(input) {
    if (!input.length) {
      return null;
    }
    const query = toSearchQuery(input);
    if (this.lastQuery === query) {
      return null;
    }
    this.lastQuery = query;
    try {
      console.log('country', this.party && this.party.country);
      const tracks = await searchForTracks(query, this.party && this.party.country);
      return this.lastQuery === query ? tracks : null;
    } catch (error) {
      console.error(error);
    }
  }

  async onTrackSelected(event) {
    const trackId = event.detail.trackId;
    try {
      if (!this.party) {
        throw new Error('Current user is not in a party');
      }
      await this.noParallelAddTrackToQueue(currentUser().uid, currentUser().displayName, this.party.id, trackId);
    } catch (error) {
      console.error(error);
    }
  }

}
customElements.define('queuespot-search-view', QueuespotSearchView);