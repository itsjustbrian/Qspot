import { QueuespotElement, html } from './queuespot-element.js';
import { db, currentUser } from './firebase-loader.js';
import { toSpotifySearchQuery } from './spotify-api.js';
import { searchForTracks } from './track-data-manager.js';
import './queuespot-search-list.js';

class QueuespotSearchView extends QueuespotElement {

  static get properties() {
    return {
      party: String
    };
  }

  constructor() {
    super();

    this.party = null;
    this._onSearchInput = (e) => this.onSearchInput(e);
  }

  ready() {    
    super.ready();
    
    this.$('search-list').addEventListener('track-selected', (e) => this.onTrackSelected(e));
  }

  render(props) {
    return html`
      <style>
        :host {
          display: block;
          contain: content
        }
      </style>
      <input id="search-input" type="search" on-input="${this._onSearchInput}}"></input>
      <queuespot-search-list id="search-list"></queuespot-search-list>
    `;
  }

  async onSearchInput(event) {
    const input = this.$('search-input').value;
    console.log('user typed input', input);
    const tracks = await this.trySearch(input);
    if (tracks) {
      this.$('search-list').tracks = tracks;
    }
  }

  async trySearch(input) {
    if (!input.length) {
      return null;
    }
    const query = toSpotifySearchQuery(input);
    if (this.lastQuery === query) {
      return null;
    }
    this.lastQuery = query;
    try {
      const tracks = await searchForTracks(query);
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
      // Don't want a user to call this concurrently and corrupt
      // the state of the counter.
      if (this.__addTrackPromise) {
        await this.__addTrackPromise;
      }
      this.__addTrackPromise = this.addTrackToQueue(trackId);
      this.addTrackToQueue(trackId);
    } catch (error) {
      console.error(error);
    }
  }

  async addTrackToQueue(trackId) {
    const existingTrackDoc = await db().collection('parties').doc(this.party).collection('tracks').doc(trackId).get();
    if (existingTrackDoc.exists) {
      throw new Error('This track is already in the queue');
    }
    const batch = db().batch();
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    let timeFirstTrackAdded = timestamp;
    let numTracksAdded;
    const memberDoc = await db().collection('parties').doc(this.party).collection('members').doc(currentUser().uid).get();
    const memberData = memberDoc.data();
    numTracksAdded = memberData.numTracksAdded + 1;
    const memberDocUpdate = {
      numTracksAdded: numTracksAdded
    };
    if (numTracksAdded === 1) {
      memberDocUpdate.timeFirstTrackAdded = timestamp;
    } else {
      timeFirstTrackAdded = memberData.timeFirstTrackAdded;
    }
    batch.update(db().collection('parties').doc(this.party).collection('members').doc(currentUser().uid), memberDocUpdate);
    batch.set(db().collection('parties').doc(this.party).collection('tracks').doc(trackId), {
      submitterId: currentUser().uid,
      submitterName: currentUser().displayName,
      trackNumber: numTracksAdded,
      memberOrderStamp: timeFirstTrackAdded,
      timestamp: timestamp
    });
    await batch.commit();
  }

}
customElements.define('queuespot-search-view', QueuespotSearchView);