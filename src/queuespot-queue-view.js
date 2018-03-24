import { QueuespotElement, html } from './queuespot-element.js';
import { TracksQueueListener } from './data-listeners.js';
import './queuespot-queue.js';

export class QueuespotQueueView extends QueuespotElement {

  static get properties() {
    return {
      party: String,
    };
  }

  constructor() {
    super();

    this.party = null;
    this.tracksQueueListener = new TracksQueueListener((e) => this.onTracksReceived(e));
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

  didRender(props, changedProps, prevProps) {
    super.didRender(changedProps);

    if (this.propertyChanged('party')) {
      if (this.party) {
        this.tracksQueueListener.attach(this.party);
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