import { QueuespotElement, html } from './queuespot-element.js';
import { replaceRoute } from './router.js';
import { firebaseLoader } from './firebase-loader.js';
import { API_URL } from './globals.js';
import request from './request.js';

class QueuespotLoginView extends QueuespotElement {

  static get properties() {
    return {
      route: Object
    };
  }

  constructor() {
    super();

    this.route = null;
    this._onSpotifySignInClicked = (event) => { this.signInToSpotify(event); };
  }

  ready() {
    super.ready();
  }

  _render({ route }) {
    return html`
      <style>
        :host {
          display: block;
          contain: content
        }
      </style>

      <button on-click="${this._onSpotifySignInClicked}">Sign in to Spotify</button>
    `;
  }

  signInToSpotify(event) {
    window.location.href = `${API_URL}/spotifyAuthRedirect`;
  }

  async createSpotifyAccount() {
    await firebaseLoader.loaded;

    const code = this.route.params.get('code');
    const state = this.route.params.get('state');
    const error = this.route.params.get('error');

    // Remove query params from url
    replaceRoute(`${this.route.previousPath}`);

    if (error || !code) {
      console.error(error || 'No code provided');
      return;
    }

    const url = `${API_URL}/createSpotifyAccount` +
      `?code=${encodeURIComponent(code)}` +
      `&state=${encodeURIComponent(state)}`;
    
    const options = {
      url: url,
      withCredentials: true
    };

    try {
      console.log('Signing in with url', url);
      const { token, providers } = await request(options);
      token && firebase.auth().signInWithCustomToken(token);
    } catch (error) {
      console.error(error.message);
    }
  }

}
customElements.define('queuespot-login-view', QueuespotLoginView);