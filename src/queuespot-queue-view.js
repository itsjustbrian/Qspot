import { QueuespotElement, html } from './queuespot-element.js';
import { TracksQueueListener } from './data-listeners.js';
import './queuespot-queue.js';

export class QueuespotQueueView extends QueuespotElement {

  static get properties() {
    return {
      partyId: String,
    };
  }

  constructor() {
    super();

    this.partyId = null;
    this.tracksQueueListener = new TracksQueueListener(this.onTracksReceived.bind(this));
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
      <queuespot-queue id="queue"></queuespot-queue>
    `;
  }

  renderCallback(oldProps) {
    if (this.propertyHasChanged('partyId')) {
      if (this.partyId) {
        this.tracksQueueListener.attach(this.partyId);
      } else {
        this.tracksQueueListener.detach();
        this.$('queue').tracks = [];
      }
    }
  }

  onTracksReceived(tracks) {
    console.log('got tracks');
    this.$('queue').tracks = tracks;
  }

}
customElements.define('queuespot-queue-view', QueuespotQueueView);