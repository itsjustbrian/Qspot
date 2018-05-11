import { QueuespotElement, html } from './queuespot-element.js';
import { MemberTracksListener, PartyMembersListener } from './data-listeners.js';
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
  }

  ready() {
    super.ready();
  }

  _render({ party, tracks }) {

    return html`
      <style>
        :host {
          display: block;
          contain: content
        }
      </style>
      <h3>Your Tracks</h3>
      <ul>
        ${(party ? tracks : []).map((track) => html`
          <li>
            ${this.getTemplateForTrack(track)} - Position in queue: ${this.trackQueuePositions.get(track.id)}
          </li>
        `)}
      </ul>
    `;
  }

  _didRender(props, changedProps, prevProps) {

    if (changedProps && 'party' in changedProps) {
      if (this.party) {
        this.memberTracksListener.attach(currentUser().uid, this.party);
        this.partyMembersListener.attach(this.party);
      } else {
        this.memberTracksListener.detach();
        this.partyMembersListener.detach();
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

  onPartyMembersReceived(members) {
    console.log('Members received, calculating positions');

    // Remove later: Should be retrieving own member data here
    let me;
    for (const [index, member] of members.entries()) {
      if (member.id === currentUser().uid) {
        me = member;
        members.splice(index, 1);
        break;
      }
    }
    if (!me) {
      return;
    }

    for (const track of this.tracks) {
      // If this is the X'th track we've submitted, then the position is at least X - number of tracks played
      let positionInQueue = track.trackNumber - me.numTracksPlayed;
      for (const member of members) {
        if (member.numTracksAdded >= track.trackNumber) {
          // We know at least trackNumber - 1 tracks submitted by this member are ahead of the track we're looking at
          let numTracksInFront = track.trackNumber - 1;

          // In this case where, for example, we are looking at the user's X'th track, and this member also has a X'th track,
          // we need to compare their ordering numbers to find out who comes first
          if (member.timeFirstTrackAdded < me.timeFirstTrackAdded) {
            numTracksInFront++;
          }

          // If these tracks have been played, they aren't in front anymore
          numTracksInFront -= member.numTracksPlayed;
          positionInQueue += numTracksInFront > 0 ? numTracksInFront : 0;

        } else {
          positionInQueue += member.numTracksAdded - member.numTracksPlayed;
        }
      }
      this.trackQueuePositions.set(track.id, positionInQueue);
    }
    this._requestRender();
  }

}
customElements.define('queuespot-party-view', QueuespotPartyView);