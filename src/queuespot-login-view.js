import { QueuespotElement, html } from './queuespot-element.js';
import { replaceRoute } from './route.js';
import { firebaseLoader } from './firebase-loader.js';
import request from './request.js';

const LOCAL_URL = 'http://localhost:5001/queuespot-917af/us-central1';
const PRODUCTION_URL = 'https://us-central1-queuespot-917af.cloudfunctions.net';
const FUNCTIONS_URL = LOCAL_URL;

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

  render(props) {
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

  didRender(props, changedProps, prevProps) {
    
    if (this.route && this.route.params.get('state')) {
      this.createSpotifyAccount();
    }
  }

  signInToSpotify(event) {
    // Need to change this url in build proccess
    window.location.href = `${FUNCTIONS_URL}/spotifyAuthRedirect`;
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

    const url = `${FUNCTIONS_URL}/createSpotifyAccount` +
      `?code=${encodeURIComponent(code)}` +
      `&state=${encodeURIComponent(state)}`;
    
    const options = {
      url: url,
      withCredentials: true
    };

    try {
      console.log('Signing in with url', url);
      const { token } = await request(options);
      firebase.auth().signInWithCustomToken(token);
    } catch (error) {
      console.error(error.message);
    }
  }

}
customElements.define('queuespot-login-view', QueuespotLoginView);