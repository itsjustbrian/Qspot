import { QueuespotElement, html } from './queuespot-element.js';
import { MemberTracksListener, PartyMembersListener, PartyDataListener } from './data-listeners.js';
import { currentUser } from './firebase-loader.js';
import { getTrackData } from './track-data-manager.js';

class QueuespotPartyView extends QueuespotElement {

  static get properties() {
    return {
      party: String,
      tracks: Array
    };
  }

  constructor() {
    super();

    this.party = null;
    this.tracks = [];
    this.numTracksPlayed = 0;
    this.trackQueuePositions = new Map();
    this.memberTracksListener = new MemberTracksListener((e) => this.onMemberTracksReceived(e));
    this.partyMembersListener = new PartyMembersListener((e) => this.onPartyMembersReceived(e));
    this.partyDataListener = new PartyDataListener((e) => this.onPartyDataReceived(e));
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
      <h3>Your Tracks</h3>
      <ul>
        ${this.tracks.map((track) => html`
          <li>
            ${this.getTemplateForTrack(track)} - Position in queue: ${this.trackQueuePositions.get(track.id) - this.numTracksPlayed}
          </li>
        `)}
      </ul>
    `;
  }

  didRender(props, changedProps, prevProps) {
    if (this.propertyChanged(changedProps, 'party')) {
      if (this.party) {
        this.memberTracksListener.attach(currentUser().uid, this.party);
        this.partyMembersListener.attach(this.party);
        this.partyDataListener.attach(this.party);
      } else {
        this.memberTracksListener.detach();
        this.partyMembersListener.detach();
        this.partyDataListener.detach();
        this.tracks = [];
      }
    }
  }

  async getTemplateForTrack(track) {
    try {
      const trackData = await getTrackData(track.id);
      return html`${trackData.name} - ${trackData.artists[0].name}`;
    } catch (error) {
      return html`Error getting track data`;
    }
  }

  onMemberTracksReceived(tracks) {
    this.tracks = tracks;
  }

  onPartyDataReceived(partyData) {
    this.numTracksPlayed = partyData.numTracksPlayed || 0;
    this.invalidate();
  }

  onPartyMembersReceived(members) {
    console.log('Members received, calculating positions');

    // Remove later: Should be retrieving own member data here
    let myOrder;
    members.forEach((member, index) => {
      if (member.id === currentUser().uid) {
        myOrder = member.timeFirstTrackAdded;
        members.splice(index, 1);
      }
    });
    if (!myOrder) {
      return;
    }
    //

    for (const track of this.tracks) {
      // If this is the third track we've submitted, then the position is at least 3
      let positionInQueue = track.trackNumber;
      for (const member of members) {
        if (member.numTracksAdded >= track.trackNumber) {
          // We know at least trackNumber - 1 tracks submitted by this member are ahead of the track we're looking at
          positionInQueue += track.trackNumber - 1;
          if (member.timeFirstTrackAdded < myOrder) {
            // In this case where, for example, we are looking at the user's 3rd track, and this member also has a 3rd track,
            // we need to compare their ordering numbers to find out who comes first
            positionInQueue++;
          }
        } else {
          positionInQueue += member.numTracksAdded;
        }
      }
      this.trackQueuePositions.set(track.id, positionInQueue);
    }
    this.invalidate();
  }

}
customElements.define('queuespot-party-view', QueuespotPartyView);