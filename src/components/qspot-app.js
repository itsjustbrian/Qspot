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

class QspotApp extends connect(store)(LitElement) {
  _render({
    appTitle,
    _page,
    _query,
    _snackbarOpened,
    _offline,
    _lazyResourcesLoaded,
    _user,
    _authInitialized,
    _authorizing
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
        visibility: hidden;
      }

      .signin-btn[visible] {
        visibility: visible;
      }

      .account-btn {
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

      .account-btn {
        padding: 2px;
        visibility: hidden;
      }

      .account-btn[visible] {
        visibility: visible;
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
        <a selected?="${_page === 'queue'}" href="/queue">Queue</a>|
        <a selected?="${_page === 'search'}" href="${`/search${_query ? '?q=' + _query : ''}`}">Search</a>|
        <a selected?="${_page === 'party'}" href="/party">Party</a>|
        <a selected?="${_page === 'join'}" href="/join">Join</a>|
        <a selected?="${_page === 'login'}" href="/login">Login</a>
      </nav>
    </header>

    <button class="signin-btn" aria-label="Sign in" visible?="${_authInitialized && !_user}"
        on-click="${() => store.dispatch(pushLocationURL('/login'))}">
      SIGN IN
    </button>
    <button class="account-btn" aria-label="Account" visible?="${_authInitialized && _user}"
        on-click="${() => store.dispatch(signOut())}">
      <img src="${_user && _user.photoURL}">
    </button>
    ${_authorizing ? html`<span>Signing in...</span>` : null}

    <!-- Main content -->
    <main role="main" class="main-content">
      <qspot-queue class="page" active?="${_page === 'queue'}"></qspot-queue>
      <qspot-search class="page" active?="${_page === 'search'}"></qspot-search>
      <qspot-party class="page" active?="${_page === 'party'}"></qspot-party>
      <qspot-join class="page" active?="${_page === 'join'}"></qspot-join>
      <qspot-login class="page" active?="${_page === 'login'}"></qspot-login>
      <qspot-404 class="page" active?="${_page === '404'}"></qspot-404>
    </main>

    <footer>
      <p>Made with &hearts; by the Polymer team.</p>
    </footer>

    ${_lazyResourcesLoaded ? html`
      <snack-bar active?="${_snackbarOpened}">
        You are now ${_offline ? 'offline' : 'online'}.
      </snack-bar>` : null}
    `;
  }

  static get properties() {
    return {
      appTitle: String,
      _page: String,
      _query: String,
      _snackbarOpened: Boolean,
      _offline: Boolean,
      _lazyResourcesLoaded: Boolean,
      _user: Object,
      _authInitialized: Boolean,
      _authorizing: Boolean
    };
  }

  _firstRendered() {
    installRouter((location) => store.dispatch(updateLocation(location)));
    installOfflineWatcher((offline) => store.dispatch(updateOffline(offline)));
    installMediaQueryWatcher('(min-width: 460px)', (matches) => store.dispatch(updateLayout(matches)));
    this.removeAttribute('unresolved');
    store.dispatch(getUser());
  }

  _didRender({ appTitle }, changeList) {
    if ('_page' in changeList) {
      const pageTitle = appTitle + (changeList._page ? ' - ' + changeList._page : '');
      updateMetadata({
        title: pageTitle,
        description: pageTitle
        // This object also takes an image property, that points to an img src.
      });
    }
  }

  _stateChanged(state) {
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
