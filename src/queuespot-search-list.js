import { QueuespotElement, html } from './queuespot-element.js';
import { db, currentUser } from './firebase-loader.js';

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
        ${this.tracks.map((track) => html`
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
      console.log('Adding track with id:', trackId);
      this.addTrackToQueue(trackId);
    }
  }

  async addTrackToQueue(trackId) {

    const partyId = await this.getCurrentParty();
    if (partyId) {
      const batch = db().batch();
      const timestamp = firebase.firestore.FieldValue.serverTimestamp();
      let timeFirstTrackAdded = timestamp;
      let numTracksAdded;
      const memberDoc = await db().collection('parties').doc(partyId).collection('members').doc(currentUser().uid).get();
      if (memberDoc.exists) {
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
        batch.update(db().collection('parties').doc(partyId).collection('members').doc(currentUser().uid), memberDocUpdate);
      } else {
        throw new Error('Current user is not in this party');
      }
      batch.set(db().collection('parties').doc(partyId).collection('tracks').doc(trackId), {
        submitterId: currentUser().uid,
        trackNumber: numTracksAdded,
        memberOrderStamp: timeFirstTrackAdded,
        timestamp: timestamp
      });
      await batch.commit();
      console.log('did it :)');
    } else {
      throw new Error('Current user is not in a party');
    }
  }

  async getCurrentParty() {
    const userId = currentUser().uid;
    const userDoc = await db().collection('users').doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data().currentParty;
    }
  }

}
customElements.define('queuespot-search-list', QueuespotSearchList);