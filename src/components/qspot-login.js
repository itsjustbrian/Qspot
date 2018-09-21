import { html } from '@polymer/lit-element';
import { PageViewElement } from './page-view-element.js';

import { store } from '../store.js';

// Actions
import { signInToSpotify, signIn } from '../actions/auth.js';

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

class QspotLogin extends (PageViewElement) {
  _render(props) {
    return html`
      ${SharedStyles}
      <section>
        <p>
          <h2>Welcome Back</h2>
          <button on-click="${() => store.dispatch(signInToSpotify())}">Sign in with Spotify</button>
          <button on-click="${() => store.dispatch(signIn())}">Sign in with Google</button>
        </p>
      </section>
    `;
  }
}

window.customElements.define('qspot-login', QspotLogin);
