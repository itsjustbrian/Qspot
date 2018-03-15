import { QueuespotElement, html } from './queuespot-element.js';
import { Route, routeLink } from './route.js';
import { firebaseLoader, db, currentUser } from './firebase-loader.js';
import { UserDataListener } from './data-listeners.js';
import { spotifyWebPlayer, PLAYER_STATES } from './spotify-web-player.js';
import './queuespot-queue-view.js';
import './queuespot-search-view.js';
import './queuespot-party-view.js';
import './queuespot-login-view.js';
import './queuespot-switch.js';

class QueuespotApp extends QueuespotElement {

  static get properties() {
    return {
      user: Object,
      route: Object
    };
  }

  constructor() {
    super();

    this.user = null;
    this.currentParty = null;
    this.route = new Route();
    this.route.onUrlChanged = () => this.invalidate();
    this._joinPartyButtonClicked = (e) => this.joinPartyButtonClicked(e);
    this._startParty = (e) => this.startParty(e);
    this.userDataListener = new UserDataListener((userData) => this.onUserDataReceived(userData));
  }

  ready() {
    super.ready();

    this.initApp();
  }

  disconnectedCallback() {
    this.route.disconnect();
    spotifyWebPlayer.cleanup();
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

      <a href="/login" on-click="${routeLink}">Login</a>
      <a href="/search" on-click="${routeLink}">Search</a>
      <a href="/queue" on-click="${routeLink}">Queue</a>
      <a href="/party" on-click="${routeLink}">Party</a>
      
      <h3>${this.user ? this.user.displayName : 'Signed out'}</h3>
      ${this.getAuthButton()}
      <button on-click="${this._joinPartyButtonClicked}">Join party</button>
      <button on-click="${this._startParty}">Start Party</button>

      <queuespot-switch selected="${this.route.currentPart}">
        <queuespot-login-view id="login-view" data-route="login" route="${this.route.sub('login')}"></queuespot-login-view>
        <queuespot-search-view id="search-view" data-route="search" route="${this.route.sub('search')}"></queuespot-search-view>
        <queuespot-queue-view id="queue-view" data-route="queue" route="${this.route.sub('queue')}"></queuespot-queue-view>
        <queuespot-party-view id="party-view" data-route="party" route="${this.route.sub('party')}"></queuespot-party-view>
      </queuespot-switch>

      <slot></slot>
    `;
  }

  getAuthButton() {
    const handler = (e) => this.user ? this.signOutButtonClicked(e) : this.signInButtonClicked(e);
    const text = this.user ? 'Sign out' : 'Sign in with Google';
    return html`<button onclick="${handler}">${text}</button>`;
  }

  signInButtonClicked(event) {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithRedirect(provider);
  }

  signOutButtonClicked(event) {
    firebase.auth().signOut();
  }

  async joinPartyButtonClicked(event) {
    const partyId = await this.getPartyWithCode('TIOS');
    await this.joinParty(partyId);
  }

  startParty(event) {
    spotifyWebPlayer.start(this.currentParty);
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

  onUserDataReceived(userData) {
    console.log('got that user data');
    this.currentParty = userData ? userData.currentParty : null;
    this.$('queue-view').party = this.currentParty;
    this.$('search-view').party = this.currentParty;
    this.$('party-view').party = this.currentParty;

    // Temporary logic for loading
    if (userData.spotifyAccessToken && spotifyWebPlayer.lifeCycle === PLAYER_STATES.NOT_LOADED) {
      spotifyWebPlayer.load();
    }
  }

  saveUser(user) {
    console.log('Saving user:', user.displayName);
    return db().collection('users').doc(user.uid).set({
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL
    }, { merge: true });
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
    const { docs } = await db().collection('parties').where('code', '==', code).get();
    return docs[0].id;
  }
  
}
customElements.define('queuespot-app', QueuespotApp);
