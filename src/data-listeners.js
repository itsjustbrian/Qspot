import { db } from './firebase-loader.js';

class FirebaseListener {

  constructor(callback) {
    this.callback = callback;
    this.unsubscribe = null;
  }

  attach(callback) {
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
    super.attach(callback);

    this.unsubscribe = db().collection('users').doc(userId).onSnapshot((doc) => {
      this.callback(doc.data());
    });
  }
}

export class TracksQueueListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  attach(partyId, callback) {
    super.attach(callback);

    this.unsubscribe = db().collection(`parties/${partyId}/tracks`).orderBy('trackNumber').orderBy('memberOrderStamp').onSnapshot((tracksSnapshot) => {
      const tracks = [];
      tracksSnapshot.forEach((doc) => {
        const track = doc.data();
        track.id = doc.id;
        tracks.push(track);
      });
      this.callback(tracks);
    });
  }
}

export class MemberTracksListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  attach(userId, partyId, callback) {
    super.attach(callback);

    this.unsubscribe = db().collection(`parties/${partyId}/tracks`).where('submitterId', '==', userId).orderBy('timestamp').onSnapshot((tracksSnapshot) => {
      const tracks = [];
      tracksSnapshot.forEach((doc) => {
        const track = doc.data();
        track.id = doc.id;
        tracks.push(track);
      });
      this.callback(tracks);
    });
  }
}

export class PartyMembersListener extends FirebaseListener {

  constructor(callback) {
    super(callback);
  }

  attach(partyId, callback) {
    super.attach(callback);

    this.unsubscribe = db().collection('parties').doc(partyId).collection('members').where('numTracksAdded', '>', 0).onSnapshot((membersSnapshot) => {
      const members = [];
      membersSnapshot.forEach((doc) => {
        const member = doc.data();
        member.id = doc.id;
        members.push(member);
      });
      this.callback(members);
    });
  }
}