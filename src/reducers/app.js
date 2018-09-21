import {
  UPDATE_LOCATION,
  RECEIVE_LAZY_RESOURCES,
  UPDATE_OFFLINE,
  OPEN_SNACKBAR,
  CLOSE_SNACKBAR,
} from '../actions/app.js';

const app = (state = {}, action) => {
  switch (action.type) {
    case UPDATE_LOCATION:
      return {
        ...state,
        page: action.page,
        params: params(state.params, action),
      };
    case RECEIVE_LAZY_RESOURCES:
      return {
        ...state,
        lazyResourcesLoaded: true
      };
    case UPDATE_OFFLINE:
      return {
        ...state,
        offline: action.offline
      };
    case OPEN_SNACKBAR:
      return {
        ...state,
        snackbarOpened: true
      };
    case CLOSE_SNACKBAR:
      return {
        ...state,
        snackbarOpened: false
      };
    default:
      return state;
  }
};

const params = (state = {}, action) => {
  switch (action.type) {
    case UPDATE_LOCATION:
      return {
        ...state,
        query: action.params.get('q'),
        code: action.params.get('code'),
        state: action.params.get('state'),
        error: action.params.get('error'),
      };
    default:
      return state;
  }
};

export default app;
