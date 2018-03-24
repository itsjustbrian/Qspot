import { QueuespotElement, html } from './queuespot-element.js';
import { Route, routeLink } from './route.js';
import { firebaseLoader } from './firebase-loader.js';
import { spotifyWebPlayer, PLAYER_STATES } from './spotify-web-player.js';
import { UserDataListener } from './data-listeners.js';
import { getParty, getPartyWithCode, joinParty, createParty, saveUser } from './queuespot-actions.js';
import './queuespot-queue-view.js';
import './queuespot-search-view.js';
import './queuespot-party-view.js';
import './queuespot-login-view.js';
import './queuespot-switch.js';

class QueuespotApp extends QueuespotElement {

  static get properties() {
    return {
      user: Object,
      route: Object,
      currentParty: String
    };
  }

  constructor() {
    super();

    this.user = null;
    this.currentParty = null;
    this.isHost = false;
    this.route = new Route();
    this.route.onUrlChanged = () => this.invalidate();
    this._joinPartyButtonClicked = (e) => this.joinPartyButtonClicked(e);
    this._startPartyButtonClicked = (e) => this.startPartyButtonClicked(e);
    this._createPartyButtonClicked = (e) => this.createPartyButtonClicked(e);
    this._listenInButtonClicked = (e) => this.listenInButtonClicked(e);
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
    firebaseLoader.addEventListener('auth-state-changed', (event) => {
      this.user = event['detail'];
      this.currentParty = this.user ? this.currentParty : null;
    });
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
      <button on-click="${this._startPartyButtonClicked}">Start Party</button>
      <button on-click="${this._createPartyButtonClicked}">Create Party</button>
      <button on-click="${this._listenInButtonClicked}">Listen in</button>

      <queuespot-switch selected="${this.route.currentPart}">
        <queuespot-login-view id="login-view" data-route="login" route="${this.route.sub('login')}"></queuespot-login-view>
        <queuespot-search-view id="search-view" data-route="search" route="${this.route.sub('search')}" party="${this.currentParty}"></queuespot-search-view>
        <queuespot-queue-view id="queue-view" data-route="queue" route="${this.route.sub('queue')}" party="${this.currentParty}"></queuespot-queue-view>
        <queuespot-party-view id="party-view" data-route="party" route="${this.route.sub('party')}" party="${this.currentParty}"></queuespot-party-view>
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
    if (this.user) {
      const partyData = await getPartyWithCode('TIOS');
      joinParty(this.user.uid, partyData.id);
    }
  }

  startPartyButtonClicked(event) {
    if (this.isHost) {
      spotifyWebPlayer.start(this.currentParty);
    }
  }

  listenInButtonClicked(event) {
    if (this.user && this.user.claims.spotifyPremium && this.currentParty && !this.isHost) {
      spotifyWebPlayer.listenIn(this.currentParty);
    }
  }

  createPartyButtonClicked(event) {
    if (this.user && this.user.claims.spotifyPremium && !this.currentParty) {
      createParty(this.user.uid);
    }
  }

  didRender(props, changedProps, prevProps) {
    super.didRender(changedProps);

    if (this.propertyChanged('user')) {
      if (this.user) {
        saveUser(this.user.uid, this.user.displayName, this.user.email, this.user.photoURL);
        this.userDataListener.attach(this.user.uid);
      } else {
        this.userDataListener.detach();
      }
    }

    if (this.propertyChanged('currentParty') && this.currentParty) {
      this.checkIfHost();
    }
  }

  onUserDataReceived(userData) {
    this.currentParty = userData ? userData.currentParty : null;

    // Temporary logic for loading
    if (this.user.claims.spotifyPremium && spotifyWebPlayer.lifeCycle === PLAYER_STATES.NOT_LOADED) {
      spotifyWebPlayer.load();
    }
  }

  async checkIfHost() {
    const partyData = await getParty(this.currentParty);
    this.isHost = partyData.host === this.user.uid;
    console.log('User is host?', this.isHost);
  }
  
}
customElements.define('queuespot-app', QueuespotApp);
