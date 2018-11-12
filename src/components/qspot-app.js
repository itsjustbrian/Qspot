import { LitElement, html } from '@polymer/lit-element';
import { connect } from 'pwa-helpers/connect-mixin.js';
import { installMediaQueryWatcher } from 'pwa-helpers/media-query.js';
import { installOfflineWatcher } from 'pwa-helpers/network.js';
import { installRouter } from 'pwa-helpers/router.js';
import { updateMetadata } from 'pwa-helpers/metadata.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

// These are the actions needed by this element.
import { updateLocation, updateOffline, updateLayout, pushLocationURL } from '../actions/app.js';
import { getUser, signOut } from '../actions/auth.js';

import { SharedStyles } from './shared-styles.js';

class QspotApp extends connect(store)(LitElement) {
  render() {
    const {
      appTitle,
      _page,
      _query,
      _snackbarOpened,
      _offline,
      _lazyResourcesLoaded,
      _user,
      _authInitialized,
      _authorizing
    } = this;

    const query = _query ? '?q=' + _query : '';

    return html`
    ${SharedStyles}
    <style>
      :host {
        display: block;
        contain: content;
        padding: 24px;
      }

      header {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .account-btn {
        display: inline-block;
        width: 40px;
        height: 40px;
        padding: 2px;
        box-sizing: border-box;
        background: none;
        border: none;
        fill: var(--app-header-text-color);
        cursor: pointer;
        text-decoration: none;
      }

      .account-btn > img {
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
        <a ?selected=${_page === 'queue'} href="/queue">Queue</a>|
        <a ?selected=${_page === 'search'} href=${`/search${query}`}>Search</a>|
        <a ?selected=${_page === 'my-tracks'} href="/my-tracks">My Tracks</a>|
        <a ?selected=${_page === 'join'} href="/join">Join</a>|
        <a ?selected=${_page === 'login'} href="/login">Login</a>
      </nav>
    </header>

    <button class="account-btn" title="Account" ?invisible=${!_authInitialized || !_user}
        @click=${this._accountBtnClicked}>
      <img src=${_user && _user.photoURL}>
    </button>
    <button class="signin-btn" title="Sign in" ?invisible=${!_authInitialized || _user}
        @click=${this._signInBtnClicked}>
      SIGN IN
    </button>
    ${_authorizing ? html`<span>Signing in...</span>` : null}

    <!-- Main content -->
    <main role="main" class="main-content">
      <qspot-queue class="page" ?active=${_page === 'queue'}></qspot-queue>
      <qspot-search class="page" ?active=${_page === 'search'}></qspot-search>
      <qspot-my-tracks class="page" ?active=${_page === 'my-tracks'}></qspot-my-tracks>
      <qspot-join class="page" ?active=${_page === 'join'}></qspot-join>
      <qspot-login class="page" ?active=${_page === 'login'}></qspot-login>
      <qspot-404 class="page" ?active=${_page === '404'}></qspot-404>
    </main>

    ${_lazyResourcesLoaded ? html`
      <snack-bar ?active=${_snackbarOpened}>
        You are now ${_offline ? 'offline' : 'online'}.
      </snack-bar>` : null}
    `;
  }

  static get properties() {
    return {
      appTitle: { type: String },
      _page: { type: String },
      _query: { type: String },
      _snackbarOpened: { type: Boolean },
      _offline: { type: Boolean },
      _lazyResourcesLoaded: { type: Boolean },
      _user: { type: Object },
      _authInitialized: { type: Boolean },
      _authorizing: { type: Boolean }
    };
  }

  firstUpdated() {
    installRouter((location) => store.dispatch(updateLocation(location)));
    installOfflineWatcher((offline) => store.dispatch(updateOffline(offline)));
    installMediaQueryWatcher('(min-width: 460px)', (matches) => store.dispatch(updateLayout(matches)));
    this.removeAttribute('unresolved');
    store.dispatch(getUser());
  }

  updated(changedProps) {
    if (changedProps.has('_page')) {
      const pageTitle = this.appTitle + (this._page ? ' - ' + this._page : '');
      updateMetadata({
        title: pageTitle,
        description: pageTitle
        // This object also takes an image property, that points to an img src.
      });
    }
  }

  _signInBtnClicked() {
    store.dispatch(pushLocationURL('/login'));
  }

  _accountBtnClicked() {
    store.dispatch(signOut());
  }

  stateChanged(state) {
    this._page = state.app.page;
    this._query = state.search && state.search.query;
    this._offline = state.app.offline;
    this._snackbarOpened = state.app.snackbarOpened;
    this._lazyResourcesLoaded = state.app.lazyResourcesLoaded;
    this._user = state.auth.user;
    this._authInitialized = state.auth.initialized;
    this._authorizing = state.auth.authorizing;
  }
}

window.customElements.define('qspot-app', QspotApp);
