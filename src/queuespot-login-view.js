import { QueuespotElement, html } from './queuespot-element.js';
import request from './request.js';

class QueuespotLoginView extends QueuespotElement {

  static get properties() {
    return {
      route: String
    };
  }

  constructor() {
    super();

    this.code = this.state = this.error = null;
    this.route = '';
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

      <a href="http://localhost:5001/queuespot-917af/us-central1/spotifyAuthRedirect">Sign in to Spotify</a>
    `;
  }

  didRender(props, changedProps, prevProps) {

    this.code = this.getURLParameter('code');
    this.state = this.getURLParameter('state');
    this.error = this.getURLParameter('error');

    if (this.code) {
      this.createSpotifyAccount();
    }
  }

  getErrorContent(errorMessage) {
    return html`<span>Error back from the Spotify auth page: ${errorMessage}</span>`;
  }

  async createSpotifyAccount() {
    const url = '/api/createSpotifyAccount' +
      `?code=${encodeURIComponent(this.code)}` +
      `&state=${encodeURIComponent(this.state)}`;

    try {
      console.log('Signing in with url', url);
      const token = await request(url).then((response) => response.token);
      firebase.auth().signInWithCustomToken(token);
    } catch (error) {
      console.error(error.message);
    }
  }

  /**
   * Returns the value of the given URL query parameter.
   * @param {String} name 
   */
  getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) ||
      [null, ''])[1].replace(/\+/g, '%20')) || null;
  }

}
customElements.define('queuespot-login-view', QueuespotLoginView);