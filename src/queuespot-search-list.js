import { QueuespotElement, html } from './queuespot-element.js';
import { repeat } from '../node_modules/lit-html/lib/repeat.js';

class QueuespotSearchList extends QueuespotElement {

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
    this.addEventListener('click', this.onClick.bind(this));

    super.ready();
  }

  render(props) {
    return html`
      <ul>
        ${repeat(this.tracks, (track) => track.id, (track) => html`
          <li>
            <button trackId=${track.id}>Add track</button>
            ${track.name}
          </li>`)}
      </ul>
    `;
  }

  onClick(event) {
    const path = event.composedPath();
    const trackId = path[0].trackId; // The button
    if (trackId) {
      this.dispatchEvent(new CustomEvent('track-selected', { detail: { trackId: trackId } }));
    }
  }

}
customElements.define('queuespot-search-list', QueuespotSearchList);