import { QueuespotElement, html } from './queuespot-element.js';
import { firebaseLoader, db, currentUser } from './firebase-loader.js';
import { UserDataListener } from './data-listeners.js';
import './queuespot-queue-view.js';
import './queuespot-search-view.js';
import './queuespot-party-view.js';

class QueuespotApp extends QueuespotElement {

  static get properties() {
    return {
      user: Object,
    };
  }

  constructor() {
    super();

    this.user = null;
    this.joinPartyButtonClicked = this.joinPartyButtonClicked.bind(this);
    this.userDataListener = new UserDataListener(this.onUserDataReceived.bind(this));
  }

  ready() {
    this.initApp();

    super.ready();
  }

  async initApp() {
    await this.renderComplete;

    await firebaseLoader.load();
    firebase.auth().onAuthStateChanged((user) => this.user = user);
  }

  render(props) {
    return html`
      <style>
        :host {
          display: block;
          contain: content
        }
      </style>
      <h1>Queuespot</h1>
      <h3>${this.user ? this.user.displayName : 'Signed out'}</h3>
      ${this.getAuthButton()}
      <button onclick="${this.joinPartyButtonClicked}">Join party</button>
      <queuespot-search-view id="search-view"></queuespot-search-view>
      <queuespot-queue-view id="queue-view"></queuespot-queue-view>
      <queuespot-party-view id="party-view"></queuespot-party-view>
      <slot></slot>
    `;
  }

  didRender(props, changedProps, prevProps) {
    if (this.propertyChanged(changedProps, 'user')) {
      if (this.user) {
        this.saveUser(this.user);
        this.userDataListener.attach(this.user.uid);
      } else {
        this.userDataListener.detach();
        this.$('queue-view').party = null;
        this.$('search-view').party = null;
        this.$('party-view').party = null;
      }
    }
  }

  getAuthButton() {
    const handler = this.user ? this.handleSignOutButtonClicked : this.handleSignInButtonClicked;
    const text = this.user ? 'Sign out' : 'Sign in';
    return html`<button onclick="${handler.bind(this)}">${text}</button>`;
  }

  handleSignInButtonClicked(event) {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithRedirect(provider);
  }

  handleSignOutButtonClicked(event) {
    firebase.auth().signOut();
  }

  onUserDataReceived(userData) {
    const currentParty = userData ? userData.currentParty : null;
    this.$('queue-view').party = currentParty;
    this.$('search-view').party = currentParty;
    this.$('party-view').party = currentParty;
  }

  saveUser(user) {
    console.log('Saving user:', user.displayName);
    return db().collection('users').doc(user.uid).set({
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL
    }, { merge: true });
  }

  async joinPartyButtonClicked(event) {
    const partyId = await this.getPartyWithCode('TIOS');
    await this.joinParty(partyId);
  }

  async joinParty(partyId) {
    const userId = currentUser().uid;
    const batch = db().batch();
    batch.update(db().collection('users').doc(userId), {
      currentParty: partyId
    });
    batch.set(db().collection('parties').doc(partyId).collection('members').doc(userId), {
      numTracksAdded: 0
    });
    await batch.commit();
    console.log('Joined party with id', partyId);
  }

  async getPartyWithCode(code) {
    const partyQuerySnapshot = await db().collection('parties').where('code', '==', code).get();
    return partyQuerySnapshot.docs[0].id;
  }
  
}
customElements.define('queuespot-app', QueuespotApp);
