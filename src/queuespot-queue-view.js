import { QueuespotElement, html } from './queuespot-element.js';
import { TracksQueueListener, PartyDataListener } from './data-listeners.js';
import './queuespot-queue.js';

export class QueuespotQueueView extends QueuespotElement {

  static get properties() {
    return {
      party: Object,
      tracks: Array,
      currentTrack: Object
    };
  }

  constructor() {
    super();

    this.party = null;
    this.tracks = [];
    this.tracksQueueListener = new TracksQueueListener((e) => this.onTracksReceived(e));
    this.partyDataListener = new PartyDataListener((e) => this.onPartyDataReceived(e));
  }

  ready() {
    super.ready();
  }

  _render({ party, tracks, currentTrack }) {

    return html`
      <style>
        :host {
          display: block;
          contain: content
        }
      </style>
      
      ${currentTrack && html`<h3>Currently Playing: ${currentTrack.name} - ${currentTrack.artists[0].name}</h3>`}
      <queuespot-queue id="queue" tracks="${party ? tracks : []}"></queuespot-queue>
    `;
  }

  _didRender(props, changedProps, prevProps) {

    if (changedProps && 'party' in changedProps) {
      if (this.party) {
        this.tracksQueueListener.attach(this.party.id);
        this.partyDataListener.attach(this.party.id);
      } else {
        this.tracksQueueListener.detach();
        this.partyDataListener.detach();
      }
    }
  }

  onTracksReceived(tracks) {
    console.log('Got tracks in queue', tracks);
    this.tracks = tracks;
  }

  onPartyDataReceived(partyData) {
    this.currentTrack = partyData && partyData.currentPlayerState &&
      partyData.currentPlayerState.track_window.current_track;
  }

}
customElements.define('queuespot-queue-view', QueuespotQueueView);