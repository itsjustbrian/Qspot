import { html } from '@polymer/lit-element';
import { PageViewElement } from './page-view-element.js';

import { store } from '../store.js';

// Actions
import { signInToSpotify, signIn } from '../actions/auth.js';

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

class QspotLogin extends (PageViewElement) {
  render() {
    return html`
      ${SharedStyles}
      <section>
        <p>
          <h2>Welcome Back</h2>
          <button @click=${this._spotifySignInBtnClicked}>Sign in with Spotify</button>
          <button @click=${this._googleSignInBtnClicked}>Sign in with Google</button>
        </p>
      </section>
    `;
  }

  _spotifySignInBtnClicked() {
    store.dispatch(signInToSpotify());
  }

  _googleSignInBtnClicked() {
    store.dispatch(signIn());
  }
}

window.customElements.define('qspot-login', QspotLogin);
