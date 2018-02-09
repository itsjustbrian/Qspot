import { QueuespotElement, html } from './queuespot-element.js';
import { repeat } from '../node_modules/lit-html/lib/repeat.js';
import { until } from '../node_modules/lit-html/lib/until.js';
import { getSpotifyTrackData } from './spotify-api.js';

import { db } from './firebase-loader.js';

class QueuespotQueue extends QueuespotElement {

  static get properties() {
    return {
      tracks: Array
    };
  }

  constructor() {
    super();

    this.tracks = [];
    this.tracksDataMap = {};
  }

  ready() {
    super.ready();
  }

  render(props) {
    return html`
      <ul>
        ${repeat(this.tracks, (track) => track.id, (track, index) => html`
          <li>
            ${until(this.getTemplateForTrack(track), html`
              <span>Loading...</span>`)}
          </li>`)}
      </ul>
    `;
  }

  async getTemplateForTrack(track) {
    const trackId = track.id;
    let trackData = this.tracksDataMap[trackId];
    if (!trackData) {
      trackData = await getSpotifyTrackData(trackId);
      this.tracksDataMap[trackId] = trackData;
      console.log('Got track', trackData);
    }
    return html`${trackData.name} - ${this.getUserInfo(track.submitterId)}`;
  }

  async getUserInfo(userId) {
    if (userId) {
      const userDoc = await db().collection('users').doc(userId).get();
      return userDoc.data().displayName;
    }
  }

}
customElements.define('queuespot-queue', QueuespotQueue);