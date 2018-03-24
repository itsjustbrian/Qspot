import { firebaseLoader, db } from './firebase-loader.js';
import { parseDoc, parseSnapshot } from './firebase-utils.js';

// todo: condense more of the code to the super class
class FirebaseListener {

  constructor(callback) {
    this.callback = callback;
    this.unsubscribe = null;
    this.dependentProps = [];
  }

  async attach(callback, ...props) {
    await firebaseLoader.loaded;

    // Shallow compare props
    let numChanged = 0;
    props.forEach((prop, index) => {
      // Exit early if prop is null
      if (!prop) { return; }
      if (this.dependentProps[index] !== prop) {
        numChanged++;
        this.dependentProps[index] = prop;
      }
    });
    if (numChanged === 0) {
      return;
    }
    if (callback) {
      this.callback = callback;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  detach() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

export class UserDataListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  async attach(userId, callback) {
    await super.attach(callback, userId);

    this.unsubscribe = db().collection('users').doc(userId).onSnapshot((doc) => {
      this.callback(parseDoc(doc));
    });
  }
}

export class TracksQueueListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  async attach(partyId, callback) {
    await super.attach(callback, partyId);

    this.unsubscribe = db().collection(`parties/${partyId}/tracks`).orderBy('trackNumber').orderBy('memberOrderStamp').onSnapshot((tracksSnapshot) => {
      this.callback(parseSnapshot(tracksSnapshot));
    });
  }
}

export class MemberTracksListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  async attach(userId, partyId, callback) {
    await super.attach(callback, userId, partyId);

    this.unsubscribe = db().collection(`parties/${partyId}/tracks`).where('submitterId', '==', userId).orderBy('timestamp').onSnapshot((tracksSnapshot) => {
      this.callback(parseSnapshot(tracksSnapshot));
    });
  }
}

export class PartyMembersListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
    this.partyId = null;
  }

  async attach(partyId, callback) {
    await super.attach(callback, partyId);

    this.unsubscribe = db().collection('parties').doc(partyId).collection('members').where('numTracksAdded', '>', 0).onSnapshot((membersSnapshot) => {
      this.callback(parseSnapshot(membersSnapshot));
    });
  }
}

export class PartyDataListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  async attach(partyId, callback) {
    await super.attach(callback, partyId);

    this.unsubscribe = db().collection('parties').doc(partyId).onSnapshot((doc) => {
      this.callback(parseDoc(doc));
    });
  }
}

export class SpotifyMetadataListener extends FirebaseListener {
   
  constructor(callback) {
    super(callback);
  }

  async attach(callback) {
    await super.attach(callback);

    this.unsubscribe = db().collection('metadata').doc('spotify').onSnapshot((doc) => {
      this.callback(parseDoc(doc));
    });
  }
}