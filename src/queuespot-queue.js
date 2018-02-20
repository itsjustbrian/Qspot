import { QueuespotElement, html } from './queuespot-element.js';
import { repeat } from '../node_modules/lit-html/lib/repeat.js';
import { until } from '../node_modules/lit-html/lib/until.js';
import { getTrackData } from './track-data-manager.js';

class QueuespotQueue extends QueuespotElement {

  static get properties() {
    return {
      tracks: Array
    };
  }

  constructor() {
    super();

    this.tracks = [];
  }

  ready() {
    super.ready();
  }

  render(props) {
    return html`
      <ol>
        ${repeat(this.tracks, (track) => track.id, (track) => html`
          <li>
            ${until(this.getTemplateForTrack(track), html`
              <span>Loading...</span>`)}
              - ${track.submitterName}
          </li>`)}
      </ol>
    `;
  }

  async getTemplateForTrack(track) {
    const trackData = await getTrackData(track.id);
    return html`${trackData.name}`;
  }

}
customElements.define('queuespot-queue', QueuespotQueue);