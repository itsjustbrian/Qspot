import { QueuespotElement, html } from './queuespot-element.js';
import { Router, routeLink } from './router.js';
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

  _render({ user, route, currentParty }) {
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
      <button on-click="${this._joinPartyButtonClicked}">Join party</button>
      <button on-click="${this._startPartyButtonClicked}">Start Party</button>
      <button on-click="${this._createPartyButtonClicked}">Create Party</button>
      <button on-click="${this._listenInButtonClicked}">Listen in</button>

      <queuespot-switch selected="${route.currentPart}" attributeForSelected="name">
        <queuespot-login-view id="login-view" name="login" route="${route.sub('login')}"></queuespot-login-view>
        <queuespot-search-view id="search-view" name="search" route="${route.sub('search')}" party="${currentParty}"></queuespot-search-view>
        <queuespot-queue-view id="queue-view" name="queue" route="${route.sub('queue')}" party="${currentParty}"></queuespot-queue-view>
        <queuespot-party-view id="party-view" name="party" route="${route.sub('party')}" party="${currentParty}"></queuespot-party-view>
      </queuespot-switch>

      <slot></slot>
    `;
  }

  async _didRender(props, changedProps, prevProps) {

    if (changedProps && 'user' in changedProps) {
      if (this.user) {
        saveUser(this.user.uid, this.user.displayName, this.user.email, this.user.photoURL);
        this.userDataListener.attach(this.user.uid);
      } else {
        this.userDataListener.detach();
      }
    }

    if (changedProps && 'currentParty' in changedProps && this.currentParty) {
      await this.checkIfHost();

      if (this.isHost && spotifyWebPlayer.lifeCycle === PLAYER_STATES.NOT_LOADED) {
        spotifyWebPlayer.load();
      }
    }
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
      if (spotifyWebPlayer.lifeCycle === PLAYER_STATES.NOT_LOADED) {
        spotifyWebPlayer.load();
      }
    }
  }

  async initApp() {
    await firebaseLoader.load();
    firebaseLoader.addEventListener('auth-state-changed', (event) => {
      this.user = event['detail'];
      this.currentParty = this.user ? this.currentParty : null;
    });
  }

  onUserDataReceived(userData) {
    this.currentParty = userData ? userData.currentParty : null;
  }

  async checkIfHost() {
    const partyData = await getParty(this.currentParty);
    this.isHost = partyData.host === this.user.uid;
    console.log('User is host?', this.isHost);
  }
  
}
customElements.define('queuespot-app', QueuespotApp);
