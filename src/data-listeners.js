import { db } from './firebase-loader.js';

// todo: condense more of the code to the super class
class FirebaseListener {

  constructor(callback) {
    this.callback = callback;
    this.unsubscribe = null;
    this.dependentProps = [];
  }

  attach(callback, ...props) {
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

  attach(userId, callback) {
    super.attach(callback, userId);

    this.unsubscribe = db().collection('users').doc(userId).onSnapshot((doc) => {
      this.callback(parseDoc(doc));
    });
  }
}

export class TracksQueueListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  attach(partyId, callback) {
    super.attach(callback, partyId);

    this.unsubscribe = db().collection(`parties/${partyId}/tracks`).orderBy('trackNumber').orderBy('memberOrderStamp').onSnapshot((tracksSnapshot) => {
      this.callback(parseSnapshot(tracksSnapshot));
    });
  }
}

export class MemberTracksListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  attach(userId, partyId, callback) {
    super.attach(callback, userId, partyId);

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

  attach(partyId, callback) {
    super.attach(callback, partyId);

    this.unsubscribe = db().collection('parties').doc(partyId).collection('members').where('numTracksAdded', '>', 0).onSnapshot((membersSnapshot) => {
      this.callback(parseSnapshot(membersSnapshot));
    });
  }
}

export class PartyDataListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  attach(partyId, callback) {
    super.attach(callback, partyId);

    this.unsubscribe = db().collection('parties').doc(partyId).onSnapshot((doc) => {
      this.callback(parseDoc(doc));
    });
  }
}

function parseDoc(doc) {
  const item = doc.data();
  item.id = doc.id;
  return item;
}

function parseSnapshot(snapshot) {
  const items = [];
  snapshot.forEach((doc) => {
    const item = doc.data();
    item.id = doc.id;
    items.push(item);
  });
  return items;
}