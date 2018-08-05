/**
@license
Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

import { LitElement, html } from '@polymer/lit-element';
import { connect } from 'pwa-helpers/connect-mixin.js';
import { installMediaQueryWatcher } from 'pwa-helpers/media-query.js';
import { installOfflineWatcher } from 'pwa-helpers/network.js';
import { installRouter } from 'pwa-helpers/router.js';
import { updateMetadata } from 'pwa-helpers/metadata.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

// These are the actions needed by this element.
import { updateLocation, updateOffline, updateLayout } from '../actions/app.js';
import { attachAuthListener, attachUserDataListener, signIn, signOut } from '../actions/auth.js';

import { accountIcon } from '../icons/qspot-icons.js';
import './snack-bar.js';

class QspotApp extends connect(store)(LitElement) {
  _render({
    appTitle,
    _page,
    _query,
    _snackbarOpened,
    _offline,
    _authInitialized,
    _user
  }) {
    return html`
    <style>
      :host {
        display: block;
        contain: content;
        padding: 24px;
        max-width: 600px;
      }

      header {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .signin-btn {
        display: inline-block;
        width: 40px;
        height: 40px;
        padding: 8px;
        box-sizing: border-box;
        background: none;
        border: none;
        fill: var(--app-header-text-color);
        cursor: pointer;
        text-decoration: none;
      }

      .signin-btn {
        padding: 2px;
        visibility: hidden;
      }

      .signin-btn[visible] {
        visibility: visible;
      }

      .signin-btn > img {
        width: 36px;
        height: 36px;
        border-radius: 50%;
      }

      .toolbar-list > a {
        display: inline-block;
        color: black;
        text-decoration: none;
        padding: 0 8px;
      }

      .toolbar-list > a[selected] {
        font-weight: bold;
      }

      /* Workaround for IE11 displaying <main> as inline */
      main {
        display: block;
      }

      .page {
        display: none;
      }

      .page[active] {
        display: block;
      }

      footer {
        border-top: 1px solid #ccc;
        text-align: center;
      }

      /* Wide layout */
      @media (min-width: 460px) {
        header {
          flex-direction: row;
        }

        /* The drawer button isn't shown in the wide layout, so we don't
        need to offset the title */
        [main-title] {
          padding-right: 0px;
        }
      }
    </style>

    <header>
      <h1>${appTitle}</h1>
      <nav class="toolbar-list">
        <a selected?="${_page === 'login'}" href="/login">Login</a>|
        <a selected?="${_page === 'search'}" href="${`/search${_query && '?q=' + _query}`}">Search</a>|
        <a selected?="${_page === 'queue'}" href="/queue">Queue</a>|
        <a selected?="${_page === 'party'}" href="/party">Party</a>
      </nav>
    </header>

    <button class="signin-btn" aria-label="Sign In" visible?="${_authInitialized}"
        on-click="${() => store.dispatch(_user && _user.imageUrl ? signOut() : signIn())}">
      ${_user && _user.imageUrl ? html`<img src="${_user.imageUrl}">` : accountIcon}
    </button>
      ${/*<input id="party-code-input"></input>
      <button on-click="${(e) => this._handleJoinParty(e)}">Join party</button>
      <button on-click="${() => store.dispatch(startParty())}">Start Party</button>
      <button on-click="${() => store.dispatch(createParty())}">Create Party</button>
    <button on-click="${() => store.dispatch(listenIn())}">Listen in</button>*/null}

    <!-- Main content -->
    <main role="main" class="main-content">
      <qspot-login class="page" active?="${_page === 'login'}"></qspot-login>
      <qspot-search class="page" active?="${_page === 'search'}"></qspot-search>
      <qspot-queue class="page" active?="${_page === 'queue'}"></qspot-queue>
      <qspot-party class="page" active?="${_page === 'party'}"></qspot-party>
      <qspot-404 class="page" active?="${_page === '404'}"></qspot-404>
    </main>

    <footer>
      <p>Made with &hearts; by the Polymer team.</p>
    </footer>

    <snack-bar active?="${_snackbarOpened}">
        You are now ${_offline ? 'offline' : 'online'}.</snack-bar>
    `;
  }

  static get properties() {
    return {
      appTitle: String,
      _page: String,
      _query: String,
      _snackbarOpened: Boolean,
      _offline: Boolean,
      _user: Object,
      _authInitialized: Boolean
    };
  }

  _firstRendered() {
    installRouter((location) => store.dispatch(updateLocation(location)));
    installOfflineWatcher((offline) => store.dispatch(updateOffline(offline)));
    installMediaQueryWatcher('(min-width: 460px)', (matches) => store.dispatch(updateLayout(matches)));
    this.removeAttribute('unresolved');
    this._partyCodeInput = this.shadowRoot.getElementById('party-code-input');
    store.dispatch(attachAuthListener());
  }

  _didRender({ appTitle, _user }, changeList, prevProps) {
    if ('_page' in changeList) {
      const pageTitle = appTitle + ' - ' + changeList._page;
      updateMetadata({
        title: pageTitle,
        description: pageTitle
        // This object also takes an image property, that points to an img src.
      });
    }

    if ('_user' in changeList && _user && !prevProps._user) {
      store.dispatch(attachUserDataListener(_user.id));
    }
  }

  _stateChanged(state) {
    this._page = state.app.page;
    this._query = state.search && state.search.query;
    this._offline = state.app.offline;
    this._snackbarOpened = state.app.snackbarOpened;
    this._authInitialized = state.auth.initialized;
    this._user = state.auth.user;
  }

  _handleJoinParty(e) {
    store.dispatch(joinParty(this._partyCodeInput.value));
  }
}

window.customElements.define('qspot-app', QspotApp);
