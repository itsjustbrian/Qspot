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
    this.addEventListener('click', (e) => this.onClick(e));

    super.ready();
  }

  render(props) {
    return html`
      <ul>
        ${repeat(this.tracks, (track) => track.id, (track) => html`
          <li>
            <button data-track$="${track.id}">Add track</button>
            ${track.name} - ${track.artists[0].name}
          </li>`)}
      </ul>
    `;
  }

  onClick(event) {
    const path = event.composedPath();
    const trackId = path[0].dataset.track; // The button
    if (trackId) {
      this.dispatchEvent(new CustomEvent('track-selected', { detail: { trackId: trackId } }));
    }
  }

}
customElements.define('queuespot-search-list', QueuespotSearchList);