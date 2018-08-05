/**
@license
Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

export const UPDATE_LOCATION = 'UPDATE_LOCATION';
export const RECEIVE_LAZY_RESOURCES = 'RECEIVE_LAZY_RESOURCES';
export const UPDATE_OFFLINE = 'UPDATE_OFFLINE';
export const OPEN_SNACKBAR = 'OPEN_SNACKBAR';
export const CLOSE_SNACKBAR = 'CLOSE_SNACKBAR';

export const updateLocation = (location) => (dispatch) => {
  // Extract the page name from path.
  const path = window.decodeURIComponent(location.pathname);
  const splitPath = (path || '').slice(1).split('/');
  let page = splitPath[0] || dispatch(replaceLocationURL('/queue'));
  const params = new URLSearchParams(location.search);
  const query = params.get('q');

  // Any other info you might want to extract from the path (like page type),
  // you can do here
  dispatch(loadPage(page, query));
};

const loadPage = (page, query) => async (dispatch, getState) => {
  let module;
  switch (page) {
    case 'login':
      await import('../components/qspot-login.js')
      break;
    case 'search':
      await import('../components/qspot-search.js');
      break;
    case 'queue':
      await import('../components/qspot-queue.js');
      break;
    case 'party':
      await import('../components/qspot-party.js');
      break;
    default:
      // Nothing matches, set page to 404
      page = '404';
  }
  
  if (page === '404') {
    import('../components/qspot-404.js');
  }

  dispatch({
    type: UPDATE_LOCATION,
    page,
    query
  });

  const lazyLoadComplete = getState().app.lazyResourcesLoaded;
  // load lazy resources after render and set `lazyLoadComplete` when done.
  if (!lazyLoadComplete) {
    requestAnimationFrame(async () => {
      await import('../components/lazy-resources.js');
      dispatch({
        type: RECEIVE_LAZY_RESOURCES
      });
    });
  }
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
