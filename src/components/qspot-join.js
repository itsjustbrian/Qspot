import { html } from '@polymer/lit-element';
import { connect } from 'pwa-helpers/connect-mixin';
import { PageViewElement } from './page-view-element.js';

import { store } from '../store.js';

// Actions
import { joinPartyWithCode, createParty } from '../actions/join.js';

// We are lazy loading its reducer.
import join from '../reducers/join.js';
store.addReducers({
  join,
});

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

class QspotJoin extends connect(store)(PageViewElement) {
  _render({ _joinError }) {
    return html`
       ${SharedStyles}
      <section>
        <p>
          <h2>Join</h2>
          <input id="party-code-input" type="text" placeholder="Enter party code">
          <button on-click="${(e) => this._handleJoinParty(e)}">Join</button>
          ${_joinError ? html`<span>${_joinError}</span>`: null}
          <br>Or...<br>
          <button on-click="${(e) => store.dispatch(createParty())}">Create Party</button>
        </p>
      </section>
    `;
  }

  static get properties() {
    return {
      _joinError: String
    };
  }

  _firstRendered() {
    this._partyCodeInput = this.shadowRoot.getElementById('party-code-input');
  }

  _handleJoinParty(event) {
    store.dispatch(joinPartyWithCode(this._partyCodeInput.value));
  }

  _stateChanged(state) {
    this._joinError = state.join.failure && state.join.error;
  }
}

window.customElements.define('qspot-join', QspotJoin);