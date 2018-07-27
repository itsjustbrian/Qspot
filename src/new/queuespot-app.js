import { QueuespotElement, html } from './queuespot-element.js';
import { Router, routeLink } from './router.js';
import { firebaseLoader, currentUser } from './firebase-loader.js';
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
      party: Object,
      route: Object
    };
  }

  constructor() {
    super();

    this.user = this.party = null;
    this.route = new Router();
    this.route.onUrlChanged = () => this._requestRender();
    this._joinPartyButtonClicked = (e) => this.joinPartyButtonClicked(e);
    this._startPartyButtonClicked = (e) => this.startPartyButtonClicked(e);
    this._createPartyButtonClicked = (e) => this.createPartyButtonClicked(e);
    this._listenInButtonClicked = (e) => this.listenInButtonClicked(e);
    this.userDataListener = new UserDataListener((userData) => this.onUserDataReceived(userData));
  }

  ready() {
    super.ready();
  }

  disconnectedCallback() {
    this.route.disconnect();
    spotifyWebPlayer.cleanup();
  }

  _firstRendered() {
    this.initApp();
  }

  _render({ user, party, route }) {
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
      
      <h3>${user ? user.displayName : 'Signed out'}</h3>
      ${this.getAuthButton()}
      <input id="code-input"></input>
      <button on-click="${this._joinPartyButtonClicked}">Join party</button>
      <button on-click="${this._startPartyButtonClicked}">Start Party</button>
      <button on-click="${this._createPartyButtonClicked}">Create Party</button>
      <button on-click="${this._listenInButtonClicked}">Listen in</button>

      <queuespot-switch selected="${route.currentPart}" attributeForSelected="name">
        <queuespot-login-view id="login-view" name="login" route="${route.sub('login')}"></queuespot-login-view>
        <queuespot-search-view id="search-view" name="search" route="${route.sub('search')}" party="${party}"></queuespot-search-view>
        <queuespot-queue-view id="queue-view" name="queue" route="${route.sub('queue')}" party="${party}"></queuespot-queue-view>
        <queuespot-party-view id="party-view" name="party" route="${route.sub('party')}" party="${party}"></queuespot-party-view>
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
      const code = this.$('code-input').value;
      const partyData = await getPartyWithCode(code);
      partyData ? joinParty(this.user.uid, partyData.id) : console.log('Party not found');
    }
  }

  startPartyButtonClicked(event) {
    if (this.user && this.user.isHost) {
      spotifyWebPlayer.start(this.user.currentParty);
    }
  }

  listenInButtonClicked(event) {
    if (this.user && this.user.claims.spotifyPremium && this.user.currentParty && !this.user.isHost) {
      spotifyWebPlayer.listenIn(this.user.currentParty);
    }
  }

  async createPartyButtonClicked(event) {
    if (this.user && this.user.claims.spotifyPremium && !this.user.currentParty) {
      await createParty(this.user.uid, this.user.spotifyCountry);
      if (spotifyWebPlayer.lifeCycle === PLAYER_STATES.NOT_LOADED) {
        spotifyWebPlayer.load();
      }
    }
  }

  async initApp() {
    await firebaseLoader.load();
    firebaseLoader.addEventListener('auth-state-changed', (event) => {
      const userData = event['detail'];
      if (userData) {
        this.userDataListener.attach(userData.uid);
        saveUser(userData.uid, userData.displayName, userData.email, userData.photoURL);
      } else {
        this.user = null;
        this.userDataListener.detach();
      }
    });
  }

  async onUserDataReceived(userData) {
    this.user = {
      ...currentUser(),
      ...userData
    };
    console.log('Set user', this.user);

    if (userData.currentParty && userData.currentParty !== (this.party && this.party.id)) { // Party has changed
      this.party = await getParty(userData.currentParty);
      this.user.isHost = this.party.host === this.user.uid;
      console.log('User is host?', this.user.isHost);
      if (this.user.isHost && spotifyWebPlayer.lifeCycle === PLAYER_STATES.NOT_LOADED) {
        spotifyWebPlayer.load();
      }
    } else if (!userData.currentParty) {
      this.party = null;
    }
  }
  
}
customElements.define('queuespot-app', QueuespotApp);
