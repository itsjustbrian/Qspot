import { createSpotifyAccount, resolveAuthorizing } from './auth.js';
import { getCurrentParty } from './party.js';
import { setupPlayer } from './player.js';

export const UPDATE_LOCATION = 'UPDATE_LOCATION';
export const RECEIVE_LAZY_RESOURCES = 'RECEIVE_LAZY_RESOURCES';
export const UPDATE_OFFLINE = 'UPDATE_OFFLINE';
export const OPEN_SNACKBAR = 'OPEN_SNACKBAR';
export const CLOSE_SNACKBAR = 'CLOSE_SNACKBAR';

export const loadPage = (module) => async (dispatch, getState) => {
  // Do work that should be done on each page load
  
  const state = getState();
  const page = state.app.page;
  const query = state.app.params.query;

  if (page === 'authorize_spotify') await dispatch(createSpotifyAccount());
  else if (!state.auth.authorizing) resolveAuthorizing();

  //if (page !== 'queue') detachQueueListener();

  switch (page) {
    case 'queue':
      await dispatch(getCurrentParty());
      await dispatch(module.attachQueueListener());
      await dispatch(setupPlayer());
      break;
    case 'search':
      await dispatch(getCurrentParty());
      await dispatch(module.searchTracks(query));
      await dispatch(setupPlayer());
      break;
    case 'my-tracks':
      await dispatch(module.loadMyTracks());
      await dispatch(setupPlayer());
      break;
  }
};

export const updateLocation = (location) => async (dispatch, getState) => {
  const path = window.decodeURIComponent(location.pathname);
  const params = new URLSearchParams(location.search);
  const splitPath = (path || '').slice(1).split('/');
  let page = splitPath[0];
  if (!page) return dispatch(replaceLocationURL('/join'));

  let pageImport;
  switch (page) {
    case 'queue':
      pageImport = import('../components/qspot-queue.js');
      break;
    case 'search':
      pageImport = import('../components/qspot-search.js');
      break;
    case 'my-tracks':
      pageImport = import('../components/qspot-my-tracks.js');
      break;
    case 'join':
      pageImport = import('../components/qspot-join.js');
      break;
    case 'login':
      pageImport = import('../components/qspot-login.js');
      break;
    case 'authorize_spotify':
      //await import('../components/loading-overlay.js')
      break;
    default:
      // Nothing matches, set page to 404
      page = '404';
  }

  dispatch({
    type: UPDATE_LOCATION,
    page,
    params
  });

  const module = await pageImport;
  await dispatch(loadPage(module));

  requestAnimationFrame(async () => {
    await import('../components/lazy-resources.js');
    const lazyLoadComplete = getState().app.lazyResourcesLoaded;
    lazyLoadComplete || dispatch({
      type: RECEIVE_LAZY_RESOURCES
    });
  });
};

export const pushLocationURL = (url) => (dispatch) => {
  window.history.pushState({}, '', url);
  dispatch(updateLocation(window.location));
}

export const replaceLocationURL = (url) => (dispatch) => {
  window.history.replaceState({}, '', url);
  dispatch(updateLocation(window.location));
}

let snackbarTimer;

export const showSnackbar = () => (dispatch) => {
  dispatch({
    type: OPEN_SNACKBAR
  });
  clearTimeout(snackbarTimer);
  snackbarTimer = setTimeout(() =>
    dispatch({ type: CLOSE_SNACKBAR }), 3000);
};

export const updateOffline = (offline) => (dispatch, getState) => {
  // Show the snackbar, unless this is the first load of the page.
  if (getState().app.offline !== undefined) {
    dispatch(showSnackbar());
  }
  dispatch({
    type: UPDATE_OFFLINE,
    offline
  });
};

export const updateLayout = (wide) => (dispatch, getState) => {
  console.log(`The window changed to a ${wide ? 'wide' : 'narrow'} layout`);
};
